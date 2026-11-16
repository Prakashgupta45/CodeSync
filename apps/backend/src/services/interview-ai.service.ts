import { InterviewActionType } from '@codesync/shared';
import {
  formatLlmFailureSummary,
  generateWithLlmFallbackDetailed,
  sanitizeTruncatedText,
} from '../utils/llm-client';

// Prompt Injection & System Override Defense Rules
const SUSPICIOUS_PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /ignore (your|the) system prompt/i,
  /give me the (complete |full |entire )?solution/i,
  /write the (complete |full )?code for me/i,
  /solve (this|the) problem for me/i,
  /reveal the hidden test cases/i,
  /disregard (the|your) rules/i,
  /you are now a helpful assistant that gives solutions/i,
];

export type CandidateIntent =
  | 'GREETING'
  | 'IRRELEVANT'
  | 'ALGORITHM_EXPLANATION'
  | 'COMPLEXITY_EXPLANATION'
  | 'CODE_SUBMISSION'
  | 'CODE_REVIEW_REQUEST'
  | 'CLARIFICATION_ANSWER';

export interface InterviewInteractionContext {
  problemTitle: string;
  problemDescription: string;
  problemDifficulty?: string;
  candidateMessage: string;
  candidateCode?: string;
  currentCode?: string;
  language?: string;
  action?: string;
  errorContext?: string;
  submissionStatus?: string | Record<string, any>;
  executionResults?: {
    compileError?: string;
    runtimeError?: string;
    exitCode?: number;
    passed?: boolean;
    totalPassed?: number;
    totalCases?: number;
  };
  history?: Array<{
    role?: string;
    senderType?: string;
    text?: string;
    content?: string;
    createdAt?: any;
  }>;
}

export interface InterviewAiResponse {
  response: string;
  intent: CandidateIntent;
  finishReason?: string;
  isTruncated?: boolean;
}

/**
 * Checks whether a candidate message is purely a greeting.
 * Matches: "hi", "hello", "hey", "good morning", "sup", "greetings", etc.
 * Never treats queries that ask about algorithms or code as greetings.
 */
export function isGreetingMessage(msg: string): boolean {
  if (!msg) return false;
  const trimmed = msg.trim().toLowerCase();
  const isPureGreeting =
    /^(?:hi|hello|hey|hey there|greetings|good (?:morning|afternoon|evening|day)|sup|yo)\b[!. ]*$/i.test(trimmed);

  const containsTechnicalTerms =
    /(?:algorithm|approach|complexity|code|window|pointer|array|string|map|hash|sort|loop|tree|graph|dp)\b/i.test(
      trimmed
    );

  return isPureGreeting && !containsTechnicalTerms && !trimmed.includes('?');
}

/**
 * Classifies candidate message intent based on evidence in the text and interaction context.
 */
export function classifyCandidateIntent(
  message: string,
  context?: Partial<InterviewInteractionContext>
): CandidateIntent {
  const trimmed = (message || '').trim().toLowerCase();

  if (context?.action === 'START_INTERVIEW') {
    return 'GREETING';
  }

  if (isGreetingMessage(trimmed)) {
    return 'GREETING';
  }

  // 1. Code submission or execution failure takes priority if explicitly triggered
  if (
    context?.submissionStatus ||
    context?.executionResults?.compileError ||
    context?.errorContext ||
    context?.action === 'DEBUG_ERROR' ||
    /\b(?:submitted|submitting|submission)\b/i.test(trimmed)
  ) {
    return 'CODE_SUBMISSION';
  }

  // 2. Code review request
  if (
    /(?:review|check|evaluate|look at)\s+(?:my\s+)?code/i.test(trimmed) ||
    /(?:how does my code look|is my code correct|is this code right)/i.test(trimmed) ||
    context?.action === 'ANALYZE_CODE'
  ) {
    return 'CODE_REVIEW_REQUEST';
  }

  // 3. Complexity explanation
  if (
    /(?:o\s*\(\s*[n1kmlog\s*^+\-]+\s*\)|big[- ]?o|time complexity|space complexity|auxiliary memory|runtime complexity)/i.test(
      trimmed
    )
  ) {
    return 'COMPLEXITY_EXPLANATION';
  }

  // 4. Algorithm explanation
  const algorithmKeywords =
    /(?:sliding window|two pointers?|hash map|hash set|unordered_map|dictionary|frequency table|binary search|dynamic programming|stack|queue|recursion|divide and conquer|greedy|sort the array|iterate|traverse|substring|subsequence)/i;
  if (
    algorithmKeywords.test(trimmed) ||
    /^(?:i will|i'll|i plan to|my approach|we can|we should|use a|let's use)\b/i.test(trimmed)
  ) {
    return 'ALGORITHM_EXPLANATION';
  }

  // 5. Short noise or irrelevant text
  if (/^(?:ok|okay|k|cool|sure|yes|no|fine|thanks|thank you)\b[!. ]*$/i.test(trimmed)) {
    return 'IRRELEVANT';
  }

  // Default to clarification answer in conversational thread
  return 'CLARIFICATION_ANSWER';
}

/**
 * Enforces that an AI interviewer response asks EXACTLY ONE primary question.
 * Strips out numbered question lists (e.g. 1. ... 2. ... 3. ...) and auxiliary extra questions.
 */
export function enforceSingleQuestion(text: string): string {
  if (!text) return text;

  // Pattern 1: Numbered list of questions (1. First? 2. Second? 3. Third?)
  // Keep only the text before the list and the first question
  if (/(?:^|\n)\s*1[.)]/.test(text) && /(?:^|\n)\s*2[.)]/.test(text)) {
    const introPart = text.split(/(?:^|\n)\s*1[.)]/)[0].trim();
    const matchFirst = text.match(/(?:^|\n)\s*1[.)]\s*(.*?)(?=\n\s*2[.)]|$)/s);
    if (matchFirst && matchFirst[1]) {
      const q = matchFirst[1].trim();
      const questionText = q.endsWith('?') ? q : q + '?';
      return introPart ? `${introPart}\n\n${questionText}` : questionText;
    }
  }

  // Pattern 2: Multiple question marks in the text
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount <= 1) {
    return text;
  }

  // Split into sentences and keep only up to the first question sentence
  const sentences = text.split(/(?<=[.?!])\s+/);
  const kept: string[] = [];
  let foundQuestion = false;

  for (const s of sentences) {
    if (s.includes('?')) {
      if (!foundQuestion) {
        kept.push(s);
        foundQuestion = true;
      }
    } else {
      if (!foundQuestion) {
        kept.push(s);
      }
    }
  }

  return kept.join(' ').trim();
}

export class InterviewAiService {
  /**
   * Sanitizes untrusted candidate input to prevent prompt injection attacks.
   */
  public sanitizeCandidateInput(input: string): { isMalicious: boolean; cleanInput: string } {
    for (const pattern of SUSPICIOUS_PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          isMalicious: true,
          cleanInput:
            'I understand you are asking for a direct solution or attempting to bypass interview rules. As your AI Interviewer, I cannot provide complete solution code or override interview constraints. Please explain your problem-solving approach or how you intend to structure your algorithm.',
        };
      }
    }
    return { isMalicious: false, cleanInput: (input || '').trim() };
  }

  /**
   * Evaluates candidate interaction with evidence-based intelligence, single-question discipline,
   * and conversation state preservation.
   */
  public async evaluateCandidateInteraction(
    context: InterviewInteractionContext
  ): Promise<InterviewAiResponse> {
    const { cleanInput, isMalicious } = this.sanitizeCandidateInput(context.candidateMessage);
    if (isMalicious) {
      return {
        response: cleanInput,
        intent: 'IRRELEVANT',
        finishReason: 'STOP',
        isTruncated: false,
      };
    }

    const intent = classifyCandidateIntent(cleanInput, context);
    const problemTitle = context.problemTitle || 'Coding Problem';
    const problemDifficulty = context.problemDifficulty || 'Medium';
    const problemDescription = context.problemDescription || '';
    const language = context.language || 'cpp';

    // 1. Strict Evidence Rule: GREETINGS NEVER EVALUATE ALGORITHMS OR CODE
    if (intent === 'GREETING' && context.action !== 'START_INTERVIEW') {
      const greetingResponse =
        "Hello! Welcome to your technical interview. Let's begin with the problem. Before writing code, please explain your initial approach and expected time complexity.";
      return {
        response: greetingResponse,
        intent: 'GREETING',
        finishReason: 'STOP',
        isTruncated: false,
      };
    }

    // 2. IRRELEVANT NOISE
    if (intent === 'IRRELEVANT') {
      const irrelevantResponse =
        "Whenever you're ready, please explain your proposed approach for solving this problem and the data structures you plan to use.";
      return {
        response: irrelevantResponse,
        intent: 'IRRELEVANT',
        finishReason: 'STOP',
        isTruncated: false,
      };
    }

    // 3. CODE EXECUTION / SUBMISSION CONTEXT
    if (intent === 'CODE_SUBMISSION') {
      const subObj = typeof context.submissionStatus === 'object' ? context.submissionStatus : null;
      const subStr = typeof context.submissionStatus === 'string' ? context.submissionStatus : '';

      const isAccepted =
        subStr === 'SUBMITTED_ACCEPTED' ||
        subObj?.passed === true ||
        subObj?.score === 100 ||
        Boolean(context.executionResults?.passed && !context.executionResults?.compileError);

      const hasCompileError = Boolean(
        subObj?.error?.toLowerCase().includes('compile') ||
        context.executionResults?.compileError ||
        context.errorContext
      );

      if (hasCompileError) {
        const errorSnippet = (
          subObj?.error ||
          context.executionResults?.compileError ||
          context.errorContext ||
          ''
        ).split('\n')[0].slice(0, 150);

        const compileResp = `Your implementation encountered a compilation error during execution: \`${errorSnippet || 'syntax error'}\`. Looking at your code syntax and variable types in ${language}, what do you think triggered this error?`;
        return {
          response: compileResp,
          intent: 'CODE_SUBMISSION',
          finishReason: 'STOP',
          isTruncated: false,
        };
      }

      if (isAccepted) {
        const acceptResp = `Excellent work! Your implementation passed all test cases with optimal runtime. Can you explain how your window left pointer jump handles repeating characters without having to backtrack?`;
        return {
          response: acceptResp,
          intent: 'CODE_SUBMISSION',
          finishReason: 'STOP',
          isTruncated: false,
        };
      }

      // Test case mismatch / Wrong Answer
      const mismatchReason = subObj?.error ? ` (${subObj.error})` : '';
      const wrongResp = `Your code produced a mismatch on one of the test cases${mismatchReason}. Looking at your inner loop condition and pointer update logic, how does your window adjust when duplicate characters are encountered?`;
      return {
        response: wrongResp,
        intent: 'CODE_SUBMISSION',
        finishReason: 'STOP',
        isTruncated: false,
      };
    }

    // 4. PREPARE CONTEXT-RICH SYSTEM PROMPT FOR GEMINI
    // Include conversation history to prevent repetition and build conversation state
    const historyLines: string[] = [];
    if (Array.isArray(context.history) && context.history.length > 0) {
      for (const h of context.history.slice(-6)) {
        const roleName = h.role === 'ai' || h.senderType === 'AI_INTERVIEWER' ? 'Interviewer' : 'Candidate';
        const textVal = h.text || h.content || '';
        if (textVal.trim()) {
          historyLines.push(`${roleName}: ${textVal.trim().slice(0, 200)}`);
        }
      }
    }
    const historyBlock =
      historyLines.length > 0
        ? `\nPREVIOUS CONVERSATION HISTORY:\n${historyLines.join('\n')}\n`
        : '';

    // Only supply code context if candidate explicitly asked for code review!
    const effectiveCode = context.candidateCode || context.currentCode;
    const codeBlock =
      intent === 'CODE_REVIEW_REQUEST' && effectiveCode && effectiveCode.trim().length > 0
        ? `\nCANDIDATE EDITOR CODE:\n\`\`\`${language}\n${effectiveCode.slice(0, 3000)}\n\`\`\`\n`
        : '';

    const isStartInterview = context.action === 'START_INTERVIEW';

    const systemPrompt = isStartInterview
      ? `You are an expert AI Technical Coding Interviewer initiating a live coding interview for CodeSync AI on "${problemTitle}" (${problemDifficulty}).

CRITICAL GUARDRAILS:
1. GREETING & PROBLEM INTRODUCTION:
   - Warmly welcome the candidate to their coding interview session.
   - Explicitly mention the problem title "${problemTitle}".
   - Ask the candidate to explain their high-level algorithmic approach, proposed data structures, and expected time and space complexity before writing code.
2. EXACTLY ONE QUESTION:
   - Ask exactly one clear opening question inviting their approach explanation.
3. CONCISE & PROFESSIONAL:
   - Keep your entire greeting under 80 words.`
      : `You are an expert AI Technical Coding Interviewer conducting a live coding interview for CodeSync AI on "${problemTitle}" (${problemDifficulty}).

CRITICAL GUARDRAILS:
1. STRICT EVIDENCE-BASED EVALUATION:
   - Only evaluate statements and ideas that the candidate ACTUALLY wrote in their message or conversation history.
   - NEVER fabricate or assume the candidate used or explained concepts they did not mention.
   - If the candidate only mentioned a high-level idea (e.g. "sliding window"), evaluate ONLY that idea without claiming they implemented or explained hash maps, formulas, or edge cases.
   - Do NOT review editor code unless the candidate explicitly asked for code review.
2. EXACTLY ONE QUESTION PER RESPONSE:
   - You MUST ask EXACTLY ONE focused primary follow-up question at the end of your response.
   - NEVER ask multiple questions.
   - NEVER output numbered lists of questions (e.g. "1. ... 2. ... 3. ...").
   - NEVER repeat questions already asked in previous turns.
3. CONCISE & PROFESSIONAL:
   - Keep your entire response under 90 words.
   - Directly assess their latest explanation first, then ask your single question.`;

    const userPrompt = isStartInterview
      ? `Action: START_INTERVIEW\nProblem: ${problemTitle} (${problemDifficulty})\nProblem Description: ${problemDescription.slice(0, 500)}\nPlease welcome the candidate to their coding interview session for "${problemTitle}" and ask for their initial approach and expected complexity:`
      : `Problem: ${problemTitle} (${problemDifficulty})\nProblem Description: ${problemDescription.slice(0, 500)}${historyBlock}${codeBlock}\nCandidate's Latest Message: "${cleanInput}"\nInterviewer Assessment & Single Follow-Up:`;

    const llmOutcome = await generateWithLlmFallbackDetailed({
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
      contextLabel: 'interview_ai',
    });

    if (llmOutcome.result && llmOutcome.result.text) {
      const sanitized = sanitizeTruncatedText(
        llmOutcome.result.text,
        Boolean(llmOutcome.result.isTruncated)
      );
      let singleQuestionResponse = enforceSingleQuestion(sanitized);

      if (isStartInterview) {
        if (!singleQuestionResponse.toLowerCase().includes(problemTitle.toLowerCase())) {
          singleQuestionResponse = `Welcome to your coding interview session! Today we will be solving "${problemTitle}". ${singleQuestionResponse}`;
        }
      }

      return {
        response: singleQuestionResponse,
        intent,
        finishReason: llmOutcome.result.finishReason || 'STOP',
        isTruncated: Boolean(llmOutcome.result.isTruncated),
      };
    }

    // 5. DETERMINISTIC FALLBACK ENGINE (when Gemini is unconfigured, mocked, or offline)
    const fallbackResponse = this.generateDeterministicInterviewerResponse(
      intent,
      cleanInput,
      problemTitle,
      problemDescription,
      context.candidateCode,
      language,
      context.action
    );

    const upstreamFailed = llmOutcome.anyProviderConfigured;
    const failureSummary = formatLlmFailureSummary(llmOutcome.failures);
    const finalResponse = upstreamFailed
      ? `*[Offline Interviewer Fallback — Google Gemini API failed (${failureSummary}); using deterministic guidance]*\n\n${fallbackResponse}`
      : fallbackResponse;

    return {
      response: finalResponse,
      intent,
      finishReason: 'STOP',
      isTruncated: false,
    };
  }

  /**
   * Deterministic evidence-based evaluation fallback when Gemini is offline or in mock test suites.
   */
  public generateDeterministicInterviewerResponse(
    intent: CandidateIntent,
    candidateMessage: string,
    problemTitle: string,
    problemDescription: string,
    candidateCode?: string,
    language?: string,
    action?: string
  ): string {
    const clean = candidateMessage.trim();

    if (action === 'START_INTERVIEW') {
      return `Welcome to your coding interview session! Today we will be solving "${problemTitle}". Before you begin writing code, please explain your initial algorithmic approach and expected time complexity.`;
    }

    switch (intent) {
      case 'GREETING':
        return "Hello! Welcome to your technical interview. Let's begin with the problem. Before writing code, please explain your initial approach and expected time complexity.";

      case 'IRRELEVANT':
        return "Whenever you're ready, please explain your proposed approach for solving this problem and the data structures you plan to use.";

      case 'COMPLEXITY_EXPLANATION': {
        const lower = clean.toLowerCase();
        if (lower.includes('o(n)') || lower.includes('o( n )') || lower.includes('linear')) {
          return "Your time complexity of O(N) and space complexity of O(N) are spot on for this approach. Please go ahead and write your implementation in the editor, and click 'Run Code' when you're ready to test.";
        }
        return `Regarding your complexity estimate (${clean}): can you break down the number of operations per iteration in your main loop to verify whether this reaches optimal O(N) time?`;
      }

      case 'ALGORITHM_EXPLANATION': {
        const lower = clean.toLowerCase();
        // Check if incomplete explanation (e.g. only mentions map or pointers without window)
        const isSlidingWindow = lower.includes('sliding window') || lower.includes('two pointer');
        const isHashMap = lower.includes('hash map') || lower.includes('map') || lower.includes('unordered_map') || lower.includes('set');

        if (isSlidingWindow) {
          return `Using a sliding window with two pointers is a solid strategy for ${problemTitle}. How do you plan to track which characters are in your window and determine when a duplicate character appears?`;
        }

        if (isHashMap && !isSlidingWindow) {
          return `A hash map is a suitable data structure for tracking seen elements. How will you use the hash map to adjust your window boundaries when finding the longest substring without repeating characters?`;
        }

        return `Thank you for sharing your approach. How does your strategy detect repeated elements while iterating through the input?`;
      }

      case 'CODE_REVIEW_REQUEST': {
        if (!candidateCode || candidateCode.trim().length === 0 || candidateCode.includes('// Starter template')) {
          return "I see only the starter template in the editor right now. Go ahead and write out your implementation, and click 'Run Code' to test it.";
        }
        return `I have reviewed your current ${language || 'solution'} code. Your overall structure is progressing well. Have you verified how your window logic handles boundary edge cases like empty strings or single-character inputs?`;
      }

      case 'CODE_SUBMISSION':
        return `Your implementation has been recorded. Can you explain how your window left pointer jump handles repeating characters without having to backtrack?`;

      case 'CLARIFICATION_ANSWER':
      default:
        return `That explanation clarifies your strategy. What is the expected Big-O time and space complexity of this approach?`;
    }
  }

  /**
   * Legacy method preserved for backward compatibility.
   */
  public async generateInterviewerResponse(
    action: InterviewActionType,
    problemTitle: string,
    problemDescription: string,
    candidateAnswer: string,
    candidateCode: string,
    language: string,
    errorContext?: string
  ): Promise<string> {
    const result = await this.evaluateCandidateInteraction({
      problemTitle,
      problemDescription,
      candidateMessage: candidateAnswer,
      candidateCode,
      language,
      action,
      errorContext,
    });
    return result.response;
  }
}

export const interviewAiService = new InterviewAiService();
