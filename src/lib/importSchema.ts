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

const monthStringSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');
const isoDateOrEmptySchema = z.string().refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
  message: 'Expected YYYY-MM-DD or empty string',
});
const ratioSchema = z.number().min(0).max(1);

const mortgageSchema = z.object({
  id: z.string(),
  type: z.enum(['annuity', 'linear', 'interest-only']),
  principal: z.number().nonnegative(),
  interestRate: ratioSchema,
  termYears: z.number().positive(),
  startDate: isoDateOrEmptySchema,
  deductibilityStartDate: isoDateOrEmptySchema.optional(),
  fixedRatePeriod: z.number().nonnegative().optional(),
  variableRateAfter: ratioSchema.optional(),
  extraRepayments: z.array(z.object({}).passthrough()).optional(),
  nhg: z.boolean().optional(),
}).passthrough();

const childcareArrangementSchema = z.object({
  id: z.string(),
  type: z.enum(['daycare', 'bso', 'gastouder']),
  hoursPerMonth: z.number().nonnegative(),
  hourlyRate: z.number().nonnegative(),
  startDate: monthStringSchema.optional(),
  endDate: monthStringSchema.optional(),
}).passthrough();

const propertySchema = z.object({
  startDate: isoDateOrEmptySchema.optional(),
  endDate: isoDateOrEmptySchema.optional(),
  value: z.number().nonnegative().optional(),
  purchaseCosts: z.number().nonnegative().optional(),
  sellingCosts: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
  mortgages: z.array(mortgageSchema),
}).passthrough();

const housingSchema = z.object({
  properties: z.array(propertySchema),
}).passthrough();

const incomeSchema = z.object({
  grossSalary: z.number(),
  careerEvents: z.array(z.object({
    id: z.string(),
    date: monthStringSchema,
    label: z.string(),
    isPartner: z.boolean().optional(),
    type: z.enum(['salary_change', 'career_break']).optional(),
    salaryChangeMode: z.enum(['set', 'delta']).optional(),
    newGrossSalary: z.number().nonnegative().optional(),
    annualSalaryDelta: z.number().optional(),
    durationMonths: z.number().positive().optional(),
    incomeReplacementRate: ratioSchema.optional(),
    monthlyExpenseChange: z.number().optional(),
  }).passthrough()).optional(),
}).passthrough();

const expenseSchema = z.object({}).passthrough();

const investmentSchema = z.object({}).passthrough();

const retirementSchema = z.object({
  targetAge: z.number(),
  pensionStartAge: z.number().optional(),
  retirementCalculationMethod: z.enum(['present-value', 'swr', 'die-with-zero']).optional(),
  safeWithdrawalRate: z.number(),
  legacyTargetAmount: z.number().optional(),
  aowMonthlyAmount: z.number().optional(),
  partnerAowMonthlyAmount: z.number().optional(),
  pensionMonthlyAmount: z.number().optional(),
  partnerPensionMonthlyAmount: z.number().optional(),
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

const lifeEventBaseSchema = z.object({
  id: z.string(),
  date: monthStringSchema,
  label: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
}).passthrough()
  .refine((value) => typeof value.label === 'string' || typeof value.name === 'string', {
    message: 'Life event must include label (or legacy name)',
  })
;

const salaryChangeEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('salary_change'),
  isPartner: z.boolean().optional(),
  salaryChangeMode: z.enum(['set', 'delta']).optional(),
  annualSalary: z.number().optional(),
  annualSalaryDelta: z.number().optional(),
  amount: z.number().optional(),
}).refine((value) => {
  if (value.salaryChangeMode === 'delta') return typeof value.annualSalaryDelta === 'number' || typeof value.amount === 'number';
  return typeof value.annualSalary === 'number' || typeof value.amount === 'number' || typeof value.annualSalaryDelta === 'number';
}, {
  message: 'Salary change must include annualSalary, annualSalaryDelta, or legacy amount',
});

const careerBreakEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('career_break'),
  isPartner: z.boolean().optional(),
  durationMonths: z.number().int().positive().optional(),
  incomeReplacementRate: ratioSchema.optional(),
  monthlyExpenseChange: z.number().optional(),
  amount: z.number().optional(),
});

const childBornEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('child_born'),
  childName: z.string().optional(),
  childMonthlyExpense: z.number().nonnegative().optional(),
  childCareArrangements: z.array(childcareArrangementSchema).optional(),
  amount: z.number().optional(),
});

const partnerChangeEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('partner_change'),
  partnerActive: z.boolean().optional(),
  monthlyExpenseChange: z.number().optional(),
  amount: z.number().optional(),
});

const cashWindfallEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('cash_windfall'),
  cashAmount: z.number().nonnegative().optional(),
  amount: z.number().optional(),
}).refine((value) => typeof value.cashAmount === 'number' || typeof value.amount === 'number', {
  message: 'Cash windfall must include cashAmount (or legacy amount)',
});

const oneTimeExpenseEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('one_time_expense'),
  cashAmount: z.number().nonnegative().optional(),
  amount: z.number().optional(),
}).refine((value) => typeof value.cashAmount === 'number' || typeof value.amount === 'number', {
  message: 'One-time expense must include cashAmount (or legacy amount)',
});

const buyPropertyEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('buy_property'),
  propertyId: z.string().optional(),
  propertyLabel: z.string().optional(),
  propertyValue: z.number().nonnegative().optional(),
  propertyWozValue: z.number().nonnegative().optional(),
  propertyAppreciationRate: ratioSchema.optional(),
  propertyOwnerOccupied: z.boolean().optional(),
  propertyRentalIncome: z.number().nonnegative().optional(),
  propertyPurchaseCosts: z.number().nonnegative().optional(),
  propertyMortgages: z.array(mortgageSchema).optional(),
  amount: z.number().optional(),
}).refine((value) => typeof value.propertyValue === 'number' || typeof value.amount === 'number', {
  message: 'Property purchase must include propertyValue (or legacy amount)',
});

const sellPropertyEventSchema = lifeEventBaseSchema.extend({
  type: z.literal('sell_property'),
  propertyId: z.string().optional(),
  salePrice: z.number().nonnegative().optional(),
  sellingCosts: z.number().nonnegative().optional(),
  amount: z.number().optional(),
}).refine((value) => typeof value.propertyId === 'string' && value.propertyId.length > 0, {
  message: 'Property sale must include propertyId',
}).refine((value) => typeof value.salePrice === 'number' || typeof value.amount === 'number', {
  message: 'Property sale must include salePrice (or legacy amount)',
});

const legacyCashEventSchema = lifeEventBaseSchema.extend({
  type: z.enum(['inheritance', 'lump_sum', 'custom']),
  amount: z.number().optional(),
  cashAmount: z.number().optional(),
}).refine((value) => typeof value.amount === 'number' || typeof value.cashAmount === 'number', {
  message: 'Legacy cash event must include amount (or cashAmount)',
});

const lifeEventSchema = z.union([
  salaryChangeEventSchema,
  careerBreakEventSchema,
  childBornEventSchema,
  partnerChangeEventSchema,
  cashWindfallEventSchema,
  oneTimeExpenseEventSchema,
  buyPropertyEventSchema,
  sellPropertyEventSchema,
  legacyCashEventSchema,
]).transform((value) => ({
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
  partnerDateOfBirth: z.string().optional(),
  lifeExpectancyAge: z.number().optional(),
  partnerLifeExpectancyAge: z.number().optional(),
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
