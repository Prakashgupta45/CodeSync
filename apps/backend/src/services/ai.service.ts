import { prisma } from '@codesync/database';
import { AiMessageDto, aiPromptSchema, AiActionType } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';
import { getIoInstance } from '../socket/collaboration.socket';
import {
  formatLlmFailureSummary,
  generateWithLlmFallbackDetailed,
} from '../utils/llm-client';

// In-Memory Rate Limiting: Max 10 AI prompts per 60 seconds per user
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < 60000);

  if (validTimestamps.length >= 10) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(userId, validTimestamps);
  return true;
}

export type PromptIntent =
  | 'greeting'
  | 'language_query'
  | 'code_question'
  | 'code_analysis';

export function detectPromptIntent(prompt: string, action?: string): PromptIntent {
  const trimmed = (prompt || '').trim().toLowerCase();

  if (action && ['EXPLAIN', 'DEBUG', 'REFACTOR', 'TESTS'].includes(action)) {
    return 'code_analysis';
  }

  // 1. Language query check:
  // Short queries or questions asking about programming languages
  // e.g. "c++ ?", "c++", "cpp", "cpp?", "python?", "what is typescript?", "can we use rust?", "what language is this?"
  const isLanguageKeyword =
    /(?:\bc\+\+(?!\w)|\b(?:cpp|python|py|javascript|js|typescript|ts|java|rust|go|golang|csharp|c#|ruby|php|swift|kotlin|language|languages)\b)/i.test(trimmed);
  const hasQuestionMark = trimmed.includes('?');

  if (
    /^(?:c\+\+|cpp|c|python|py|javascript|js|typescript|ts|java|rust|go|golang|csharp|c#)\s*\??$/i.test(trimmed) ||
    (isLanguageKeyword && (hasQuestionMark || /\b(what|how|why|can|support|use|language|syntax|compiler|version)\b/i.test(trimmed)))
  ) {
    return 'language_query';
  }

  // 2. Greeting check:
  // Strict greeting: only matches common greetings when NOT asking about code or language
  // e.g., "hello", "hi", "hey", "good morning", "good evening"
  // Never classify queries with '?' or programming words as greetings!
  const isPureGreeting = /^(?:hi|hello|hey|hey there|greetings|good (?:morning|afternoon|evening|day)|sup|yo)\b[!. ]*$/i.test(trimmed);
  if (isPureGreeting && !isLanguageKeyword && !hasQuestionMark) {
    return 'greeting';
  }

  // 3. Question check:
  if (hasQuestionMark || /^(?:what|how|why|where|when|can|could|is|are|does|do)\b/i.test(trimmed)) {
    return 'code_question';
  }

  return 'code_analysis';
}

export function detectLanguageFromCode(code: string): string | null {
  if (!code || code.trim().length === 0) return null;

  // C++ / C markers
  if (
    /#include\s+[<"]/.test(code) ||
    /\bstd::(?:cout|cin|endl|vector|string|map|unordered_map)\b/.test(code) ||
    /\bcout\s*<</.test(code) ||
    (/\bint\s+main\s*\(/.test(code) && (/#include/.test(code) || /std::/.test(code)))
  ) {
    return 'cpp';
  }

  // Python markers
  if (
    /^(?:def|class|import|from)\s+[a-zA-Z_]/m.test(code) ||
    /if\s+__name__\s*==\s*['"]__main__['"]\s*:/m.test(code)
  ) {
    return 'python';
  }

  // Java markers
  if (
    /\bpublic\s+class\s+[a-zA-Z_]/.test(code) ||
    /\bSystem\.(?:out|err)\.print/.test(code)
  ) {
    return 'java';
  }

  // TypeScript markers
  if (
    /\b(?:interface|type)\s+[a-zA-Z_]/.test(code) ||
    /:\s*(?:string|number|boolean|any|void)\b/.test(code)
  ) {
    return 'typescript';
  }

  // JavaScript markers
  if (
    /\b(?:const|let|var)\s+[a-zA-Z_]/.test(code) ||
    /\bconsole\.log\(/.test(code) ||
    /\bfunction\s+[a-zA-Z_]/.test(code)
  ) {
    return 'javascript';
  }

  return null;
}

export function detectLanguageFromPrompt(prompt: string): string | null {
  const lower = (prompt || '').toLowerCase();
  if (/(?:\bc\+\+(?!\w)|\bcpp\b)/i.test(lower)) return 'cpp';
  if (/\b(?:python|py)\b/i.test(lower)) return 'python';
  if (/\b(?:java)\b/i.test(lower) && !/\b(?:javascript)\b/i.test(lower)) return 'java';
  if (/\b(?:typescript|ts)\b/i.test(lower)) return 'typescript';
  if (/\b(?:javascript|js)\b/i.test(lower)) return 'javascript';
  if (/\b(?:rust)\b/i.test(lower)) return 'rust';
  if (/\b(?:go|golang)\b/i.test(lower)) return 'go';
  return null;
}

export function resolveLanguage(params: {
  prompt?: string;
  roomLanguage?: string;
  code?: string;
}): string {
  // 1. Explicit language mentioned in user prompt (e.g. "c++ ?")
  const promptLang = params.prompt ? detectLanguageFromPrompt(params.prompt) : null;
  if (promptLang) {
    return promptLang;
  }

  // 2. Room context language if specified and not generic/unknown
  if (
    params.roomLanguage &&
    params.roomLanguage.trim().length > 0 &&
    params.roomLanguage.toLowerCase() !== 'unknown'
  ) {
    const norm = params.roomLanguage.toLowerCase().trim();
    if (norm === 'c++') return 'cpp';
    return norm;
  }

  // 3. Inspect code snippet
  if (params.code && params.code.trim().length > 0) {
    const codeLang = detectLanguageFromCode(params.code);
    if (codeLang) return codeLang;
  }

  // 4. Do not assume typescript when unknown
  return 'unknown';
}

export function countCodeLines(code?: string): number {
  if (!code || code.trim().length === 0) return 0;
  return code.split('\n').filter((l) => l.trim().length > 0).length;
}

export function detectEntrySymbol(code?: string, language?: string): string | null {
  if (!code || code.trim().length === 0) return null;
  const cppMatch = code.match(/\b(?:int|void|bool|auto)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
  if (cppMatch && cppMatch[1]) return cppMatch[1];

  const jsMatch = code.match(/(?:function|def|async function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (jsMatch && jsMatch[1]) return jsMatch[1];

  const classMatch = code.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (classMatch && classMatch[1]) return classMatch[1];

  return null;
}

export class AiService {
  public async promptAi(
    roomId: string,
    userId: string,
    action: AiActionType = 'CHAT',
    userPrompt?: string,
    inputCode?: string,
    errorContext?: string,
    verifiedCandidateRoomId?: string,
    clientSignal?: AbortSignal
  ): Promise<AiMessageDto> {
    // 1. Verify Room and Database Membership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        document: { select: { content: true } },
      },
    });

    let executor = {
      id: userId,
      name: 'Candidate',
      role: 'PARTICIPANT' as 'OWNER' | 'PARTICIPANT' | 'VIEWER',
    };
    let roomLanguage: string | undefined = undefined;

    const isVerifiedCandidate = Boolean(
      verifiedCandidateRoomId &&
        verifiedCandidateRoomId === roomId &&
        userId === 'candidate-user'
    );

    if (room) {
      const member = room.members.find((m) => m.userId === userId);
      if (!member) {
        if (isVerifiedCandidate) {
          executor = {
            id: userId,
            name: 'Candidate',
            role: 'PARTICIPANT',
          };
          roomLanguage = room.language;
        } else {
          throw new AppError('You are not a member of this room and cannot access AI assistant', 403, 'FORBIDDEN');
        }
      } else {
        // Security Authorization Guard: VIEWER role cannot prompt AI
        if (member.role === 'VIEWER') {
          throw new AppError('Viewers have read-only access and cannot send AI prompts', 403, 'FORBIDDEN');
        }

        executor = {
          id: member.user.id,
          name: member.user.name,
          role: member.role as 'OWNER' | 'PARTICIPANT' | 'VIEWER',
        };
        roomLanguage = room.language;
      }
    } else {
      if (!isVerifiedCandidate) {
        throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
      }
    }

    // 2. Enforce Per-User Rate Limiting
    if (!checkRateLimit(userId)) {
      throw new AppError('AI rate limit exceeded. Please wait a minute before sending more requests.', 429, 'RATE_LIMIT_EXCEEDED');
    }

    const sourceCode = (inputCode && inputCode.trim().length > 0)
      ? inputCode
      : room?.document?.content || '';

    const language = resolveLanguage({
      prompt: userPrompt,
      roomLanguage,
      code: sourceCode,
    });

    const promptText = (userPrompt && userPrompt.trim().length > 0)
      ? userPrompt.trim()
      : `Perform ${action} on the current ${language !== 'unknown' ? language : 'workspace'} codebase`;

    // 3. Validate Zod Payload
    const validationResult = aiPromptSchema.safeParse({
      roomId,
      prompt: promptText,
      action,
      code: sourceCode,
      errorContext,
    });

    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      throw new AppError(issue.message, 400, 'INVALID_AI_PROMPT_PAYLOAD');
    }

    // 4. Generate AI Intelligence Output
    const aiResponseText = await this.generateLlmResponse(
      validationResult.data.action as AiActionType,
      validationResult.data.prompt || '',
      sourceCode,
      language,
      errorContext,
      clientSignal
    );

    let messageId = `msg-${Date.now()}`;
    let createdAtIso = new Date().toISOString();

    if (room) {
      // 5. Persist AI Message in PostgreSQL Database
      const dbRecord = await prisma.aiMessage.create({
        data: {
          roomId,
          userId: executor.id,
          prompt: validationResult.data.prompt || '',
          response: aiResponseText,
          action: validationResult.data.action,
        },
      });
      messageId = dbRecord.id;
      createdAtIso = dbRecord.createdAt.toISOString();
    }

    const aiMessageDto: AiMessageDto = {
      id: messageId,
      roomId,
      userId: executor.id,
      userName: executor.name,
      userRole: executor.role,
      prompt: validationResult.data.prompt || '',
      response: aiResponseText,
      action: validationResult.data.action as AiActionType,
      createdAt: createdAtIso,
    };

    // 6. Broadcast Real-Time AI Response to connected room members via Socket.IO
    const io = getIoInstance();
    if (io) {
      io.to(roomId).emit('ai:response', aiMessageDto);
    }

    return aiMessageDto;
  }

  public async getRoomAiHistory(
    roomId: string,
    userId: string,
    verifiedCandidateRoomId?: string
  ): Promise<AiMessageDto[]> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: { select: { userId: true } },
      },
    });

    const isVerifiedCandidate = Boolean(
      verifiedCandidateRoomId &&
        verifiedCandidateRoomId === roomId &&
        userId === 'candidate-user'
    );

    if (!room) {
      if (isVerifiedCandidate) {
        return [];
      }
      throw new AppError('Coding room not found', 404, 'ROOM_NOT_FOUND');
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember && !isVerifiedCandidate) {
      throw new AppError('You are not authorized to view AI history for this room', 403, 'FORBIDDEN');
    }

    const messages = await prisma.aiMessage.findMany({
      where: { roomId },
      include: {
        user: { select: { id: true, name: true } },
        room: {
          include: {
            members: { select: { userId: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => {
      const userMember = m.room.members.find((rm) => rm.userId === m.userId);
      return {
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        userName: m.user.name,
        userRole: userMember ? userMember.role : 'PARTICIPANT',
        prompt: m.prompt,
        response: m.response,
        action: m.action as AiActionType,
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  private async generateLlmResponse(
    action: AiActionType,
    prompt: string,
    code: string,
    language: string,
    errorContext?: string,
    clientSignal?: AbortSignal
  ): Promise<string> {
    const systemInstruction = `You are an expert AI pair programming assistant for CodeSync AI. Answer queries cleanly in markdown. Language context: ${language}.`;
    const userMessage = `Action: ${action}\nPrompt: ${prompt}\nCode:\n\`\`\`${language}\n${code}\n\`\`\`${errorContext ? `\nError Output:\n${errorContext}` : ''}`;

    const llmOutcome = await generateWithLlmFallbackDetailed({
      systemPrompt: systemInstruction,
      userPrompt: userMessage,
      maxTokens: 1000,
      contextLabel: 'pair_ai',
      signal: clientSignal,
    });

    if (llmOutcome.result) {
      return llmOutcome.result.text;
    }

    const upstreamFailed = llmOutcome.anyProviderConfigured;
    const failureSummary = formatLlmFailureSummary(llmOutcome.failures);

    // Offline Static Analysis & Response Engine (final fallback when unconfigured or upstream providers fail)
    const promptIntent = detectPromptIntent(prompt, action);
    const lineCount = countCodeLines(code);
    const fnName = detectEntrySymbol(code, language) || (lineCount > 0 ? 'main logic' : null);
    const langDisplay = language === 'cpp' ? 'C++' : language.toUpperCase();

    switch (action) {
      case 'EXPLAIN':
        return (
          `### 💡 Code Explanation (${langDisplay})\n\n` +
          (upstreamFailed
            ? `*[Offline Static Analysis — Google Gemini API failed (${failureSummary}); showing static analysis]*\n\n`
            : `*[Offline Static Analysis — configure \`GEMINI_API_KEY\` for live LLM explanations]*\n\n`) +
          `- **Detected Entry / Symbol**: \`${fnName || 'none'}\` (${lineCount} non-empty lines)\n` +
          `- **Language**: ${language}\n\n` +
          `\`\`\`${language}\n${code || '// No code provided'}\n\`\`\``
        );

      case 'DEBUG':
        return (
          `### 🐞 AI Debugger Analysis (${langDisplay})\n\n` +
          (upstreamFailed
            ? `*[Offline Static Analysis — Google Gemini API failed (${failureSummary}); showing offline diagnostics]*\n\n`
            : `*[Offline Static Analysis — configure \`GEMINI_API_KEY\` for live LLM debugging]*\n\n`) +
          `- **Language**: ${language}\n` +
          (errorContext
            ? `**Diagnosed Execution Error**:\n\`\`\`text\n${errorContext}\n\`\`\`\n\n`
            : '**Error Context**: No compiler/runtime traceback was attached.\n\n') +
          `**Targeted Checklist for \`${fnName || 'codebase'}\`**:\n` +
          `- Check empty-input and boundary conditions in \`${fnName || 'functions'}\`.\n` +
          `- Verify return types and variable initialization across all branches.`
        );

      case 'REFACTOR':
        return (
          `### ⚡ Refactoring Suggestions (${langDisplay})\n\n` +
          (upstreamFailed
            ? `*[Offline Static Analysis — Google Gemini API failed (${failureSummary}); automatic rewrite unavailable]*\n\n`
            : `*[Offline Static Analysis — external LLM key (\`GEMINI_API_KEY\`) is not configured to rewrite your code automatically]*\n\n`) +
          `- **Language**: ${language}\n` +
          `- Analyzed \`${fnName || 'codebase'}\` (${lineCount} lines).\n` +
          `- Consider breaking nested blocks into early-return guards and keeping helper functions pure.`
        );

      case 'TESTS':
        return (
          `### 🧪 Generated Unit Test Suite (${langDisplay})\n\n` +
          `*[Offline Template for \`${fnName || 'main logic'}\` — replace placeholder inputs with your expected cases]*\n\n` +
          `\`\`\`${language}\n` +
          (language === 'python'
            ? `import unittest\n\nclass Test${(fnName || 'main').charAt(0).toUpperCase() + (fnName || 'main').slice(1)}(unittest.TestCase):\n    def test_basic_case(self):\n        # TODO: call ${fnName || 'main'}(...) with concrete inputs and assert output\n        pass\n\nif __name__ == '__main__':\n    unittest.main()`
            : language === 'cpp'
            ? `#include <cassert>\n#include <iostream>\n\nvoid test_${fnName || 'basic'}() {\n    // TODO: assert expected output for ${fnName || 'function'}\n}\n\nint main() {\n    test_${fnName || 'basic'}();\n    std::cout << "All tests passed!" << std::endl;\n    return 0;\n}`
            : language === 'javascript' || language === 'typescript'
            ? `describe('${fnName || 'suite'}', () => {\n  it('handles expected inputs', () => {\n    // TODO: call ${fnName || 'target'}(...) and assert expected result\n  });\n});`
            : `// Test harness template for ${fnName || 'logic'} in ${language}\n// TODO: invoke ${fnName || 'function'}(...) with boundary inputs and verify output`) +
          `\n\`\`\``
        );

      case 'CHAT':
      default: {
        const header =
          `### 🤖 AI Pair Programmer Response (Offline Mode)\n\n` +
          (upstreamFailed
            ? `Google Gemini API is configured, but live request failed (${failureSummary}). Returning offline fallback mode.\n\n`
            : `External LLM API (\`GEMINI_API_KEY\`) is not configured in the backend environment, so live generative chat is unavailable.\n\n`);

        const details =
          `- **Detected Intent**: \`${promptIntent}\`\n` +
          `- **Language**: \`${language}\`\n` +
          (fnName
            ? `- **Context Analyzed**: \`${fnName}\` (${lineCount} non-empty lines)\n\n`
            : `- **Context Lines**: ${lineCount}\n\n`);

        if (promptIntent === 'language_query') {
          return (
            header +
            details +
            `**${langDisplay} in CodeSync AI**:\n` +
            (language === 'cpp'
              ? `CodeSync AI supports C++ (compiled via \`g++ -O3\` in a secure Docker sandbox). You can write standard C++ using \`#include <iostream>\` and execute it directly in the editor.`
              : `CodeSync AI supports ${langDisplay} execution and real-time collaboration.`)
          );
        }

        if (promptIntent === 'greeting') {
          return (
            header +
            details +
            `Hello! I am your CodeSync AI Pair Programmer. Ask me any questions about your code, debugging, or programming languages.`
          );
        }

        return (
          header +
          details +
          `**Prompt received**: "${prompt}"`
        );
      }
    }
  }
}

export const aiService = new AiService();
