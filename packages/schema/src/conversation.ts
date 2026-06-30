import { z } from 'zod';

export const ConversationModeSchema = z.enum([
  'RESUME_BUILDING', 'JOB_APPLICATION', 'CAREER_EXPLORATION',
  'ATS_OPTIMIZATION', 'COVER_LETTER', 'INTERVIEW_PREP',
]);
export type ConversationMode = z.infer<typeof ConversationModeSchema>;

export const ConversationContextSchema = z.object({
  mode: ConversationModeSchema,
  resumeId: z.string().uuid().optional(),
  jobDescription: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
});
export type ConversationContext = z.infer<typeof ConversationContextSchema>;

export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  toolCalls: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().nullable(),
  context: ConversationContextSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messages: z.array(ConversationMessageSchema).optional(),
});
export type ConversationSession = z.infer<typeof ConversationSessionSchema>;

export const ConversationSessionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  context: ConversationContextSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messageCount: z.number().int(),
});
export type ConversationSessionSummary = z.infer<typeof ConversationSessionSummarySchema>;
