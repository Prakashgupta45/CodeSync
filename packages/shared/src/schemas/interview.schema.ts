import { z } from 'zod';

export const createInterviewSchema = z.object({
  roomId: z.string().min(1, { message: 'Valid Room ID is required' }),
  title: z.string().min(3, { message: 'Title must be at least 3 characters long' }),
  problemId: z.string().optional(),
  language: z.string().default('javascript'),
  duration: z.number().int().positive().default(45),
  instructions: z.string().optional(),
});

export const interviewMessageSchema = z.object({
  interviewId: z.string().min(1, { message: 'Valid Interview ID is required' }),
  content: z.string().min(1, { message: 'Message content cannot be empty' }),
  action: z
    .enum([
      'START_INTERVIEW',
      'ASK_APPROACH',
      'ANALYZE_CODE',
      'ASK_COMPLEXITY',
      'DEBUG_ERROR',
      'FOLLOW_UP',
      'EVALUATE',
      'FINAL_REPORT',
    ])
    .optional(),
  codeContext: z.string().optional(),
  errorContext: z.string().optional(),
});

export const submitInterviewSchema = z.object({
  interviewId: z.string().min(1, { message: 'Valid Interview ID is required' }),
  finalCode: z.string().optional(),
});

export type CreateInterviewPayload = z.infer<typeof createInterviewSchema>;
export type InterviewMessagePayload = z.infer<typeof interviewMessageSchema>;
export type SubmitInterviewPayload = z.infer<typeof submitInterviewSchema>;

const portalLanguageEnum = z.enum(['cpp', 'java', 'python', 'javascript', 'typescript']);

const portalTestCaseSchema = z.object({
  id: z.number().int(),
  input: z.string(),
  expectedOutput: z.string(),
});

const portalProblemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    category: z.string().min(1),
    description: z.string().min(1),
    inputFormat: z.string(),
    outputFormat: z.string(),
    constraints: z.array(z.string()),
    examples: z.array(
      z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string().optional(),
      })
    ),
    visibleTestCases: z.array(portalTestCaseSchema),
    hiddenTestCases: z.array(portalTestCaseSchema).default([]),
    hiddenTestCount: z.number().int().nonnegative().optional(),
    expectedTimeComplexity: z.string(),
    expectedSpaceComplexity: z.string(),
    marks: z.number().optional(),
    starterTemplates: z.record(z.string(), z.string()),
  })
  .passthrough();

export const createPortalInterviewSchema = z.object({
  title: z.string().trim().min(2).max(200),
  role: z.enum(['SDE', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer']),
  candidateName: z.string().trim().min(1).max(120),
  candidateEmail: z.string().trim().email().max(200),
  experienceLevel: z.enum(['Junior (0-2 yrs)', 'Mid-level (2-5 yrs)', 'Senior (5+ yrs)']),
  interviewType: z.enum(['DSA', 'Frontend', 'Backend', 'Full Stack']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  duration: z.number().int().min(5).max(240),
  scheduledDate: z.string().trim().min(1).max(64),
  instructions: z.string().max(4000).default(''),
  permittedLanguages: z.array(portalLanguageEnum).min(1),
  defaultLanguage: portalLanguageEnum,
  problems: z.array(portalProblemSchema).min(1).max(5),
  aiSettings: z.object({
    enableAi: z.boolean(),
    followUpQuestions: z.boolean(),
    allowHints: z.boolean(),
    allowAssistance: z.boolean(),
    requireApproachExplanation: z.boolean(),
    enableExecution: z.boolean(),
    enableVideoProctor: z.boolean(),
    evaluationCriteria: z.array(z.string()),
  }),
});

export const updatePortalInterviewSchema = z.object({
  status: z.enum(['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledDate: z.string().trim().min(1).max(64).optional(),
  instructions: z.string().max(4000).optional(),
});

export const submitPortalInterviewSchema = z.object({
  submittedCode: z.string().min(1).max(50000),
  language: portalLanguageEnum,
});

export const executePortalInterviewSchema = z.object({
  language: portalLanguageEnum,
  code: z.string().min(1).max(50000),
});

export const aiPortalInterviewSchema = z.object({
  action: z.string().trim().min(1).max(50).default('CHAT'),
  prompt: z.string().max(4000).optional(),
  code: z.string().max(50000).optional(),
  errorContext: z.string().max(4000).optional(),
});
