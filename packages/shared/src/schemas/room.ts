import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z
    .string({ required_error: 'Room name is required' })
    .min(2, 'Room name must be at least 2 characters long')
    .max(50, 'Room name must be less than 50 characters')
    .trim(),
  language: z.enum(['javascript', 'python', 'cpp', 'java', 'typescript'], {
    required_error: 'Language selection is required',
    invalid_type_error: 'Supported languages are: javascript, python, cpp, java, typescript',
  }),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
