import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Zod schema for validating imported Financeer JSON files.
// We purposely use `.passthrough()` on objects so that unknown-but-harmless
// future fields don't reject the file.  Critical structural constraints are
// enforced; leaf values are coerced where possible.
// ---------------------------------------------------------------------------

const taxBracketSchema = z.object({
  upperLimit: z.union([z.number(), z.null()]),
  rate: z.number(),
}).passthrough();

const taxCreditsSchema = z.object({
  maxAmount: z.number().optional(),
  maxCredit: z.number().optional(),
}).passthrough()
  .refine((value) => typeof value.maxAmount === 'number' || typeof value.maxCredit === 'number', {
    message: 'Tax credit must include maxAmount (or legacy maxCredit)',
  })
  .transform((value) => ({
    ...value,
    maxAmount: value.maxAmount ?? value.maxCredit ?? 0,
  }));

const taxConfigSchema = z.object({
  box1Brackets: z.array(taxBracketSchema).min(1),
  generalTaxCredit: taxCreditsSchema,
  labourTaxCredit: taxCreditsSchema,
}).passthrough();

const mortgageSchema = z.object({
  id: z.string(),
  type: z.enum(['annuity', 'linear', 'interest-only']),
  principal: z.number(),
  interestRate: z.number(),
  termYears: z.number(),
  startDate: z.string(),
}).passthrough();

const propertySchema = z.object({
  mortgages: z.array(mortgageSchema),
}).passthrough();

const housingSchema = z.object({
  properties: z.array(propertySchema),
}).passthrough();

const incomeSchema = z.object({
  grossSalary: z.number(),
}).passthrough();

const expenseSchema = z.object({}).passthrough();

const investmentSchema = z.object({}).passthrough();

const retirementSchema = z.object({
  targetAge: z.number(),
  pensionStartAge: z.number().optional(),
  safeWithdrawalRate: z.number(),
  pensionType: z.enum(['fixed', 'middelloon']).optional(),
  pensionAccrualRate: z.number().optional(),
  pensionFranchise: z.number().optional(),
  pensionServiceStartAge: z.number().optional(),
  pensionPartTimeFactor: z.number().optional(),
  pensionEarlyRetirementPenalty: z.number().optional(),
}).passthrough()
  .transform((value) => ({
    ...value,
    pensionStartAge: value.pensionStartAge ?? value.targetAge,
    pensionType: value.pensionType ?? 'fixed',
  }));

const toeslagenSchema = z.object({}).passthrough();

const lifeEventSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  name: z.string().optional(),
}).passthrough()
  .refine((value) => typeof value.label === 'string' || typeof value.name === 'string', {
    message: 'Life event must include label (or legacy name)',
  })
  .transform((value) => ({
    ...value,
    label: value.label ?? value.name ?? '',
  }));

const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  income: incomeSchema,
  tax: taxConfigSchema,
  expenses: expenseSchema,
  housing: housingSchema,
  investments: investmentSchema,
  retirement: retirementSchema,
  toeslagen: toeslagenSchema,
  lifeEvents: z.array(lifeEventSchema).optional().default([]),
}).passthrough();

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  taxLawYear: z.number().optional(),
}).passthrough();

export const importFileSchema = z.object({
  scenarios: z.array(scenarioSchema).min(1, 'File must contain at least one scenario'),
  settings: settingsSchema,
  activeScenarioId: z.string().optional(),
}).passthrough();

export type ImportFileData = z.infer<typeof importFileSchema>;

/**
 * Validate imported JSON and return a result object.
 * On success, returns `{ success: true, data }`.
 * On failure, returns `{ success: false, errors }` with human-readable messages.
 */
export function validateImport(raw: unknown):
  | { success: true; data: ImportFileData }
  | { success: false; errors: string[] } {
  const result = importFileSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = z.prettifyError(result.error)
    .split('\n')
    .filter(Boolean)
    .slice(0, 10);                  // Cap displayed errors
  return { success: false, errors };
}
