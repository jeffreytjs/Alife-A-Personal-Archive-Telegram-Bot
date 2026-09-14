import { z } from 'zod';

const generatorSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('list'),
    words: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('initialOfCalendarUnit'),
    unit: z.enum(['weekday', 'month']),
    letterSource: z.literal('firstCharacter'),
    wordList: z.literal('byLetter'),
  }),
]);

const phaseSchema = z.object({
  id: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generator: z.string().min(1),
});

const dayOverrideSchema = z.union([
  z.object({ word: z.string().min(1) }),
  z.object({ generator: z.string().min(1) }),
]);

export const promptConfigSchema = z.object({
  version: z.literal(1),
  timezone: z.string().min(1),
  dailyAt: z.string().regex(/^\d{2}:\d{2}$/),
  phases: z.array(phaseSchema).min(1),
  generators: z.record(generatorSchema),
  lists: z.object({
    byLetter: z.record(z.array(z.string().min(1)).min(1)),
  }),
  alternate: z.object({
    generator: z.string().min(1),
    excludePrimary: z.boolean().default(true),
  }),
  overrides: z.object({
    days: z.record(dayOverrideSchema).default({}),
    weeks: z.record(z.object({ generator: z.string().min(1) })).default({}),
    months: z.record(
      z.union([
        z.object({ generator: z.string().min(1) }),
        z.object({ word: z.string().min(1) }),
      ]),
    ).default({}),
  }),
}).superRefine((cfg, ctx) => {
  for (const phase of cfg.phases) {
    if (!cfg.generators[phase.generator]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Phase "${phase.id}" references unknown generator "${phase.generator}"`,
        path: ['phases'],
      });
    }
  }

  if (!cfg.generators[cfg.alternate.generator]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Alternate references unknown generator "${cfg.alternate.generator}"`,
      path: ['alternate', 'generator'],
    });
  }
});

export type PromptConfig = z.infer<typeof promptConfigSchema>;
export type PromptGenerator = z.infer<typeof generatorSchema>;
