import { z } from 'zod';

export const SUPPORTED_LANGUAGES = [
  'c',
  'cpp',
  'java',
  'python',
  'javascript',
  'typescript',
  'go',
  'rust',
  'csharp',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const createRoomSchema = z.object({
  name: z
    .string({ required_error: 'Room name is required' })
    .min(2, 'Room name must be at least 2 characters long')
    .max(50, 'Room name must be less than 50 characters')
    .trim(),
  language: z.enum(SUPPORTED_LANGUAGES, {
    required_error: 'Language selection is required',
    invalid_type_error: 'Supported languages are: c, cpp, java, python, javascript, typescript, go, rust, csharp',
  }),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const updateRoomLanguageSchema = z.object({
  language: z.string({
    required_error: 'Language is required',
  }).min(1, 'Language cannot be empty'),
});

export type UpdateRoomLanguageInput = z.infer<typeof updateRoomLanguageSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(['PARTICIPANT', 'VIEWER'], {
    required_error: 'Role is required',
    invalid_type_error: 'Allowed roles are PARTICIPANT or VIEWER',
  }),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const sendChatMessageSchema = z.object({
  roomId: z.string({ required_error: 'Room ID is required' }).min(1, 'Room ID is required'),
  content: z
    .string({ required_error: 'Message content is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

export const executeCodeSchema = z.object({
  roomId: z.string({ required_error: 'Room ID is required' }).min(1, 'Room ID is required'),
  language: z.string({
    required_error: 'Language selection is required',
  }).min(1, 'Language cannot be empty'),
  code: z.string().max(50000, 'Code payload exceeds 50KB maximum limit').optional(),
});

export type ExecuteCodeInput = z.infer<typeof executeCodeSchema>;

export const aiPromptSchema = z.object({
  roomId: z.string({ required_error: 'Room ID is required' }).min(1, 'Room ID is required'),
  prompt: z.string().max(4000, 'Prompt exceeds 4000 characters limit').optional(),
  action: z.enum(['CHAT', 'EXPLAIN', 'DEBUG', 'REFACTOR', 'TESTS']).default('CHAT'),
  code: z.string().max(50000, 'Code payload exceeds 50KB limit').optional(),
  errorContext: z.string().max(10000, 'Error context exceeds 10KB limit').optional(),
});

export type AiPromptInput = z.infer<typeof aiPromptSchema>;
