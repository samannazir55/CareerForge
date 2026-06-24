import { z } from 'zod';

export const ATSResultSchema = z.object({
  score: z.number(),
  missingKeywords: z.array(z.string()),
  missingSections: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type ATSResult = z.infer<typeof ATSResultSchema>;

export const JobMatchResultSchema = z.object({
  matchScore: z.number(),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export type JobMatchResult = z.infer<typeof JobMatchResultSchema>;
