const SENSITIVE_KEY_PATTERN =
  /password|passwordhash|secret|token|cookie|authorization|credential|api_?key|database_url/i;

function maskTokenStrings(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '[REDACTED_JWT]');
}

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return maskTokenStrings(value);
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskTokenStrings(value.message),
      ...(process.env.NODE_ENV !== 'production' && value.stack
        ? { stack: maskTokenStrings(value.stack) }
        : {}),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSensitive(val, depth + 1);
      }
    }
    return out;
  }
  return value;
}

type LogLevel = 'info' | 'warn' | 'error';

function emitLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'test' && process.env.DEBUG_TEST_LOGS !== 'true') {
    return;
  }
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: maskTokenStrings(message),
    ...(meta ? (redactSensitive(meta) as Record<string, unknown>) : {}),
  };
  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emitLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emitLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emitLog('error', message, meta),
};
