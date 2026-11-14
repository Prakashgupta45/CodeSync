import { logger } from './logger';

export type LlmProviderName = 'gemini';

export type LlmFailureReason =
  | 'invalid_api_key'
  | 'insufficient_balance'
  | 'rate_limited'
  | 'http_error'
  | 'timeout'
  | 'network_error'
  | 'malformed_json'
  | 'empty_response';

export interface LlmCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  contextLabel?: string;
  signal?: AbortSignal;
}

export interface LlmCompletionResult {
  text: string;
  provider: LlmProviderName;
  model: string;
  latencyMs: number;
}

export interface LlmProviderFailure {
  provider: LlmProviderName;
  reason: LlmFailureReason;
  status: number | null;
}

export interface LlmFallbackOutcome {
  result: LlmCompletionResult | null;
  anyProviderConfigured: boolean;
  geminiConfigured: boolean;
  failures: LlmProviderFailure[];
}

export interface LlmClientConfig {
  geminiApiKey: string | null;
  geminiModel: string;
  timeoutMs: number;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_LLM_TIMEOUT_MS = 60000;

/**
 * Trim whitespace and strip matching surrounding quotes from `.env` credentials.
 */
export function normalizeCredential(val?: string): string {
  if (!val) return '';
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Check whether an API key environment value is genuinely configured
 * rather than empty or a template placeholder.
 */
export function isConfiguredApiKey(val?: string): boolean {
  const trimmed = normalizeCredential(val);
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return (
    trimmed.length > 10 &&
    lower !== 'mock-key' &&
    !lower.startsWith('your-') &&
    !lower.startsWith('your_') &&
    !lower.includes('placeholder')
  );
}

/**
 * Parse configurable LLM timeout in milliseconds, defaulting to 60000ms.
 */
export function parseLlmTimeoutMs(raw?: string): number {
  if (!raw) return DEFAULT_LLM_TIMEOUT_MS;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LLM_TIMEOUT_MS;
}

/**
 * Read active LLM provider configuration from `process.env`.
 */
export function getLlmConfig(source: NodeJS.ProcessEnv = process.env): LlmClientConfig {
  return {
    geminiApiKey: isConfiguredApiKey(source.GEMINI_API_KEY)
      ? normalizeCredential(source.GEMINI_API_KEY)
      : null,
    geminiModel: source.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    timeoutMs: parseLlmTimeoutMs(source.LLM_TIMEOUT_MS),
  };
}

/**
 * Format safe provider failure details for fallback notices without exposing secrets or URLs.
 */
export function formatLlmFailureSummary(failures: LlmProviderFailure[]): string {
  if (failures.length === 0) return 'upstream request failed';
  return failures
    .map((f) => `${f.provider}: ${f.reason}${f.status !== null ? ` (HTTP ${f.status})` : ''}`)
    .join(', ');
}

function classifyHttpStatus(status: number): LlmFailureReason {
  if (status === 401 || status === 403) return 'invalid_api_key';
  if (status === 402) return 'insufficient_balance';
  if (status === 429) return 'rate_limited';
  return 'http_error';
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  );
}

interface ProviderCallOutcome {
  result: LlmCompletionResult | null;
  failure?: LlmProviderFailure;
}

async function callGeminiProvider(params: {
  model: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  extractText: (data: unknown) => string | undefined;
  timeoutMs: number;
  contextLabel?: string;
  promptCharCount: number;
  contextCharCount: number;
  signal?: AbortSignal;
}): Promise<ProviderCallOutcome> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  let clientAborted = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, params.timeoutMs);

  const onClientAbort = () => {
    clientAborted = true;
    controller.abort();
  };

  if (params.signal) {
    if (params.signal.aborted) {
      clientAborted = true;
      controller.abort();
    } else {
      params.signal.addEventListener('abort', onClientAbort, { once: true });
    }
  }

  let status: number | null = null;

  try {
    const response = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...params.headers,
      },
      body: JSON.stringify(params.body),
      signal: controller.signal,
    });

    status = response.status;
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const reason = classifyHttpStatus(status);
      logger.warn('LLM provider request failed; advancing to offline fallback', {
        provider: 'gemini' as LlmProviderName,
        model: params.model,
        durationMs: latencyMs,
        timeoutThresholdMs: params.timeoutMs,
        promptCharCount: params.promptCharCount,
        contextCharCount: params.contextCharCount,
        httpStatus: status,
        errorCategory: 'http_error',
        reason,
        context: params.contextLabel,
      });
      return {
        result: null,
        failure: { provider: 'gemini', reason, status },
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      logger.warn('LLM provider returned malformed JSON; advancing to offline fallback', {
        provider: 'gemini' as LlmProviderName,
        model: params.model,
        durationMs: latencyMs,
        timeoutThresholdMs: params.timeoutMs,
        promptCharCount: params.promptCharCount,
        contextCharCount: params.contextCharCount,
        httpStatus: status,
        errorCategory: 'malformed_json',
        reason: 'malformed_json' satisfies LlmFailureReason,
        context: params.contextLabel,
      });
      return {
        result: null,
        failure: { provider: 'gemini', reason: 'malformed_json', status },
      };
    }

    const extracted = params.extractText(payload)?.trim();
    if (!extracted) {
      logger.warn('LLM provider returned empty content; advancing to offline fallback', {
        provider: 'gemini' as LlmProviderName,
        model: params.model,
        durationMs: latencyMs,
        timeoutThresholdMs: params.timeoutMs,
        promptCharCount: params.promptCharCount,
        contextCharCount: params.contextCharCount,
        httpStatus: status,
        errorCategory: 'empty_response',
        reason: 'empty_response' satisfies LlmFailureReason,
        context: params.contextLabel,
      });
      return {
        result: null,
        failure: { provider: 'gemini', reason: 'empty_response', status },
      };
    }

    logger.info('LLM completion succeeded', {
      provider: 'gemini' as LlmProviderName,
      model: params.model,
      durationMs: latencyMs,
      timeoutThresholdMs: params.timeoutMs,
      promptCharCount: params.promptCharCount,
      contextCharCount: params.contextCharCount,
      httpStatus: status,
      context: params.contextLabel,
    });

    return {
      result: {
        text: extracted,
        provider: 'gemini',
        model: params.model,
        latencyMs,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    let reason: LlmFailureReason;
    let errorCategory: string;

    if (isAbortError(err)) {
      if (clientAborted) {
        reason = 'timeout';
        errorCategory = 'client_abort';
      } else {
        reason = 'timeout';
        errorCategory = 'timeout';
      }
    } else {
      reason = 'network_error';
      errorCategory = 'network_error';
    }

    logger.warn('LLM provider request aborted or errored; advancing to offline fallback', {
      provider: 'gemini' as LlmProviderName,
      model: params.model,
      durationMs: latencyMs,
      timeoutThresholdMs: params.timeoutMs,
      promptCharCount: params.promptCharCount,
      contextCharCount: params.contextCharCount,
      httpStatus: status,
      errorCategory,
      reason,
      context: params.contextLabel,
    });
    return {
      result: null,
      failure: { provider: 'gemini', reason, status },
    };
  } finally {
    clearTimeout(timeoutId);
    if (params.signal) {
      params.signal.removeEventListener('abort', onClientAbort);
    }
  }
}

function extractGeminiText(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const candidates = (
    data as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: unknown; thought?: unknown }>;
        };
      }>;
    }
  ).candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  const answerPart = parts.find(
    (part) => !part?.thought && typeof part?.text === 'string' && part.text.trim().length > 0
  );
  if (answerPart && typeof answerPart.text === 'string') {
    return answerPart.text;
  }
  const firstText = parts[0]?.text;
  return typeof firstText === 'string' ? firstText : undefined;
}

/**
 * Execute an LLM completion request via the Google Gemini API and return
 * structured fallback diagnostics so callers can distinguish missing configuration
 * from runtime upstream failures.
 */
export async function generateWithLlmFallbackDetailed(
  request: LlmCompletionRequest
): Promise<LlmFallbackOutcome> {
  const config = getLlmConfig();
  const geminiConfigured = Boolean(config.geminiApiKey);
  const failures: LlmProviderFailure[] = [];

  logger.info('Evaluating LLM provider configuration', {
    geminiConfigured,
    geminiModel: config.geminiModel,
    context: request.contextLabel,
  });

  if (geminiConfigured) {
    const promptCharCount = request.userPrompt ? request.userPrompt.length : 0;
    const contextCharCount = request.systemPrompt ? request.systemPrompt.length : 0;

    const geminiOutcome = await callGeminiProvider({
      model: config.geminiModel,
      url: `${GEMINI_API_BASE_URL}/${config.geminiModel}:generateContent`,
      headers: {
        'x-goog-api-key': config.geminiApiKey!,
      },
      body: {
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
        generationConfig: { maxOutputTokens: request.maxTokens },
      },
      extractText: extractGeminiText,
      timeoutMs: config.timeoutMs,
      contextLabel: request.contextLabel,
      promptCharCount,
      contextCharCount,
      signal: request.signal,
    });

    if (geminiOutcome.result) {
      return {
        result: geminiOutcome.result,
        anyProviderConfigured: true,
        geminiConfigured,
        failures,
      };
    }
    if (geminiOutcome.failure) {
      failures.push(geminiOutcome.failure);
    }
  }

  return {
    result: null,
    anyProviderConfigured: geminiConfigured,
    geminiConfigured,
    failures,
  };
}

/**
 * Execute an LLM completion request via Google Gemini API:
 * Returns the completion result or `null` if unconfigured / failed.
 */
export async function generateWithLlmFallback(
  request: LlmCompletionRequest
): Promise<LlmCompletionResult | null> {
  const outcome = await generateWithLlmFallbackDetailed(request);
  return outcome.result;
}
