// ============================================================
// Financeer — TypeScript Type Definitions
// ============================================================

// ---- Shared Utility Types ----

export interface TimeStamped {
  createdAt: string;
  updatedAt: string;
}

// ---- App State ----

export interface AppState {
  schemaVersion: number;
  activeScenarioId: string;
  scenarios: Scenario[];
  settings: GlobalSettings;
}

// ---- Global Settings ----

export interface GlobalSettings {
  theme: 'light' | 'dark' | 'system';
  themeVariant: 'warm' | 'cool';
  accentColor: 'default' | 'coral' | 'honey' | 'blue' | 'green' | 'red' | 'purple' | 'pink' | 'teal' | 'stone';
  currency: string;
  locale: string;
  inflationRate: number;
  showRealValues: boolean;
  simulationEndAge: number;
  dateOfBirth: string; // ISO date
  partnerDateOfBirth: string; // ISO date; empty string falls back to dateOfBirth for partner assumptions
  lifeExpectancyAge: number;
  partnerLifeExpectancyAge: number;
  taxLawYear: number; // Single source of truth for tax + toeslagen presets
  onboardingCompleted: boolean;
  dismissedHints: string[]; // IDs of dismissed per-module contextual hints
}

// ---- Scenario ----

export interface Scenario extends TimeStamped {
  id: string;
  name: string;
  income: IncomeConfig;
  tax: TaxConfig;
  expenses: ExpenseConfig;
  housing: HousingConfig;
  investments: InvestmentConfig;
  retirement: RetirementConfig;
  toeslagen: ToeslagenConfig;
  lifeEvents: LifeEvent[];
}

// ---- Income ----

export interface IncomeConfig {
  grossSalary: number;
  holidayAllowance: number;
  thirteenthMonth: boolean;
  thirteenthMonthAmount: number;
  bonusAmount: number;
  meritIncreaseRate: number;
  hasPartner: boolean; // Enables partner income fields; household status lives in tax.filingType
  partnerGrossSalary: number;
  partnerHolidayAllowance: number;
  partnerMeritIncreaseRate: number;
  partnerThirteenthMonth: boolean;
  partnerBonusAmount: number;
  box2Income: number;          // Annual income from substantial interest (Box 2)
  sideIncomes: SideIncome[];
  careerEvents: CareerEvent[];
}

export interface SideIncome {
  id: string;
  label: string;
  grossAmount: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
  isSelfEmployed: boolean;
}

export interface Box2Config {
  lowerRate: number;        // e.g. 0.245 (24.5%)
  lowerBracketLimit: number; // e.g. 67000
  upperRate: number;        // e.g. 0.33 (33%)
}

export interface CareerEvent {
  id: string;
  date: string;
  label: string;
  isPartner: boolean;
  type: 'salary_change' | 'career_break';
  salaryChangeMode?: SalaryChangeMode;
  newGrossSalary?: number;
  annualSalaryDelta?: number;
  durationMonths?: number;
  incomeReplacementRate?: number;
  monthlyExpenseChange?: number;
}

// ---- Tax ----

export interface TaxConfig {
  filingType: 'single' | 'couple';
  presetYear: number;
  box1Brackets: TaxBracket[];
  generalTaxCredit: TaxCreditConfig;
  labourTaxCredit: TaxCreditConfig;
  box2: Box2Config;
  box3: Box3Config;
  socialContributions: SocialContributionsConfig;
  eigenwoningforfaitRate: number;
  eigenwoningforfaitThreshold: number;
  iack: IACKConfig;
  ouderenkorting: OuderenKortingConfig;
  jonggehandicaptenkorting: number;
  jonggehandicaptEnabled: boolean;
  selfEmployment: SelfEmploymentConfig;
  taxOptimizations: TaxOptimizationsConfig;
}

export interface SelfEmploymentConfig {
  zelfstandigenaftrek: number;    // flat deduction for qualifying self-employed (€5,030 in 2025, phasing out)
  mkbWinstvrijstelling: number;   // percentage of profit exempt (13.31% in 2025)
  startersaftrek: number;         // extra deduction for starters (€2,123)
  isStarter: boolean;             // first 3 years → qualifies for startersaftrek
}

export interface TaxOptimizationsConfig {
  // Jaarruimte / Lijfrente
  lijfrenteAnnualContribution: number;  // user-entered amount
  jaarruimteMaxIncome: number;          // max income for calculation (€137,800)
  jaarruimtePercent: number;            // 13.3%
  jaarruimteThreshold: number;          // franchise (€17,545)
  jaarruimteMax: number;                // absolute max (€15,986)
  factorA: number;                      // pension accrual factor (0 if no employer pension)

  // Hillen arrangement
  hillenEnabled: boolean;
  hillenStartYear: number;              // 2019
  hillenPhaseOutYears: number;          // 30 years

  // Giftenaftrek
  giftenRegular: number;                // annual regular charitable gifts
  giftenPeriodiek: number;              // annual periodic gifts (5yr commitment)
  giftenThresholdPercent: number;       // 1% of income threshold for regular gifts
  giftenMaxPercent: number;             // 10% of income max for regular gifts

  // Green investments (Box 3)
  greenInvestments: number;             // amount in green investments
  greenExemptionPerPerson: number;      // €71,251 per person
  greenTaxCredit: number;               // 0.7%

  // Alimentatie (spousal alimony)
  alimentatie: number;                  // annual spousal alimony paid (fully deductible from Box 1)
}

export interface TaxBracket {
  upperLimit: number | null; // null = no limit (top bracket)
  rate: number;
}

export interface TaxCreditConfig {
  maxAmount: number;
  phaseOutStart: number;
  phaseOutEnd: number;
  /** Minimum credit after full phase-out (e.g. €69 for arbeidskorting 2025) */
  minAmount?: number;
  buildUpStart?: number;   // for labour credit
  buildUpEnd?: number;     // for labour credit
  /** Multi-segment build-up rates. If provided, used instead of linear build-up.
   *  Each segment: income up to `upTo` → credit = baseAmount + rate × (income − segmentStart).
   *  Segments are processed in order; the first matching segment applies. */
  buildUpSegments?: { upTo: number; rate: number; baseAmount: number }[];
}

export interface Box3Config {
  freeThreshold: number;     // per person
  savingsRate: number;       // fictional return rate
  investmentRate: number;
  debtRate: number;
  debtThreshold: number;     // schuldendrempel per person — debts below this are ignored
  taxRate: number;
}

export interface SocialContributionsConfig {
  zvwRate: number;
  zvwMaxIncome: number;
}

export interface IACKConfig {
  maxAmount: number;
  incomeThreshold: number;
  buildUpRate: number;
}

export interface OuderenKortingConfig {
  maxAmount: number;
  phaseOutStart: number;
  phaseOutRate: number;
  alleenstaandAmount: number;
}

// ---- Expenses ----

export interface ExpenseConfig {
  monthlyFixed: ExpenseItem[];
  monthlyVariable: ExpenseItem[];
  annualExpenses: ExpenseItem[];
  children: ChildConfig[];
  healthcareMonthlyPremium: number;
  healthcareDeductible: number;
  partnerHealthcareMonthlyPremium: number;
  partnerHealthcareDeductible: number;
  oneOffExpenses: OneOffExpense[];
  customInflationRate?: number;
}

export interface ExpenseItem {
  id: string;
  label: string;
  amount: number;
  category: string;
}

export interface ChildcareArrangement {
  id: string;
  type: 'daycare' | 'bso' | 'gastouder';
  hoursPerMonth: number;
  hourlyRate: number;
  startDate?: string;
  endDate?: string;
}

export interface ChildConfig {
  id: string;
  name: string;
  birthDate: string;
  monthlyExpense: number;
  childcareArrangements?: ChildcareArrangement[];
  kinderopvangType: 'none' | 'daycare' | 'bso' | 'gastouder';
  kinderopvangHoursPerMonth: number;
  kinderopvangHourlyRate: number;
  /** First month of childcare, e.g. "2024-01". Defaults to birth date when omitted. */
  kinderopvangStartDate?: string;
  /** Last month of childcare (inclusive), e.g. "2028-06". Defaults to age-limit when omitted. */
  kinderopvangEndDate?: string;
}

export interface OneOffExpense {
  id: string;
  label: string;
  amount: number;
  date: string;
}

// ---- Housing ----

export interface HousingConfig {
  properties: Property[];
}

export interface Property {
  id: string;
  label: string;
  startDate: string;
  endDate?: string;
  value: number;
  appreciationRate: number;
  mortgages: MortgageConfig[];
  wozValue: number;
  isOwnerOccupied: boolean;
  rentalIncome: number;
  purchaseCosts?: number;
  sellingCosts?: number;
  salePrice?: number;
}

export interface MortgageConfig {
  id: string;
  label: string;
  type: 'annuity' | 'linear' | 'interest-only';
  principal: number;
  interestRate: number;
  fixedRatePeriod: number;
  variableRateAfter: number;
  termYears: number;
  startDate: string;
  deductibilityStartDate: string;   // start of 30-year interest deduction clock (defaults to startDate)
  extraRepayments: ExtraRepayment[];
  nhg: boolean;
}

export interface ExtraRepayment {
  id: string;
  date: string;
  amount: number;
}

// ---- Investments ----

export interface InvestmentConfig {
  currentSavings?: number; // Legacy import field; migrated into a savings account on load
  emergencyFund: number;
  monthlySavingsOverride?: number;
  autoSweepAccountId?: string;
  accounts: InvestmentAccount[];
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: 'brokerage' | 'real-estate' | 'lijfrente' | 'savings';
  balance: number;
  monthlyContribution: number;
  expectedReturn: number;
  /** Annual return standard deviation for Monte Carlo (e.g. 0.15 = 15%). Default 0. */
  volatility: number;
  expenseRatio: number;
  compoundingFrequency: 'monthly' | 'annual';
  reinvestDividends: boolean;
  payoutPhase?: 'accumulation' | 'fixed-term' | 'lifetime';
  payoutStartYear?: number;
  payoutDurationYears?: number;
  partnerContinuation?: boolean;
}

// ---- Retirement ----

export interface RetirementConfig {
  targetAge: number;
  pensionStartAge: number;
  desiredAnnualSpending: number;
  safeWithdrawalRate: number;
  aowStartAge: number;
  aowMonthlyAmount: number;
  partnerAowMonthlyAmount?: number;
  /** When pensionType is 'fixed', this is the flat monthly pension. When 'middelloon', it is computed and stored here for display. */
  pensionMonthlyAmount: number;
  partnerPensionMonthlyAmount?: number;
  withdrawalStrategy: 'proportional' | 'tax-efficient';
  /** 'fixed' = user enters a flat monthly amount. 'middelloon' = estimated from career data. */
  pensionType?: 'fixed' | 'middelloon';
  /** Annual accrual rate for middelloon (e.g. 0.01875 = 1.875%). */
  pensionAccrualRate?: number;
  /** Franchise (drempelbedrag) subtracted from salary before pension accrual. */
  pensionFranchise?: number;
  /** Age when pension accrual started (beginning of career). */
  pensionServiceStartAge?: number;
  /** Part-time factor for pension accrual (1.0 = full-time). */
  pensionPartTimeFactor?: number;
  /** Actuarial early-retirement penalty per year before AOW age (e.g. 0.065 = 6.5%/yr). */
  pensionEarlyRetirementPenalty?: number;
}

// ---- Toeslagen (Government Benefits) ----

export interface ToeslagenConfig {
  enabled: boolean;
  presetYear: number;
  zorgtoeslag: ZorgtoeslagParams;
  kindgebondenBudget: KindgebondenBudgetParams;
  kinderbijslag: KinderbijslagParams;
  kinderopvangtoeslag: KinderopvangtoeslagParams;
  huurtoeslag: HuurtoeslagParams;
}

export interface ZorgtoeslagParams {
  enabled: boolean;
  standaardpremie: number;
  drempelinkomen: number;
  drempelPercentageSingle: number;
  drempelPercentageCouple: number;
  excessPercentage: number;
  vermogensGrensSingle: number;
  vermogensGrensCouple: number;
}

export interface KindgebondenBudgetParams {
  enabled: boolean;
  basePerChild: number;
  supplement12to15: number;
  supplement16to17: number;
  singleParentExtra: number;
  drempelinkomen: number;
  coupleExtraThreshold: number;
  reductionRate: number;
}

export interface KinderbijslagParams {
  enabled: boolean;
  quarterly0to5: number;
  quarterly6to11: number;
  quarterly12to17: number;
}

export interface KinderopvangtoeslagParams {
  enabled: boolean;
  // Max hourly rates by type
  maxHourlyRateDaycare: number;
  maxHourlyRateBso: number;
  maxHourlyRateGastouder: number;
  maxHoursPerMonth: number;
  // Income-dependent reimbursement table (simplified: brackets of income → percentage for 1st / 2nd+ child)
  firstChildPercentage: number;   // default percentage for average income
  secondChildPercentage: number;  // higher percentage for 2nd+ child
  incomeThresholdLow: number;     // below this → max percentage
  incomeThresholdHigh: number;    // above this → min percentage
  minPercentage: number;          // minimum reimbursement %
  maxPercentage: number;          // maximum reimbursement % (96%)
}

export interface HuurtoeslagParams {
  enabled: boolean;
  monthlyRent: number;            // user's monthly kale huur
  basishuur: number;              // minimum rent threshold (€ per month)
  aftoppingsgrens: number;        // caps for 1-2 person households
  maxHuur: number;                // absolute max rent eligible
  maxInkomenSingle: number;       // max combined annual income (single)
  maxInkomenCouple: number;       // max combined annual income (couple/multi)
  vermogensGrens: number;         // max assets (vermogen) to be eligible
}

// ---- Life Events ----

export type LifeEventType =
  | 'salary_change'
  | 'buy_property'
  | 'sell_property'
  | 'child_born'
  | 'career_break'
  | 'partner_change'
  | 'cash_windfall'
  | 'one_time_expense';

export type SalaryChangeMode = 'set' | 'delta';

export interface LifeEvent {
  id: string;
  type: LifeEventType;
  date: string;
  label: string;
  description?: string;

  // Salary changes
  isPartner?: boolean;
  salaryChangeMode?: SalaryChangeMode;
  annualSalary?: number;
  annualSalaryDelta?: number;

  // Career break
  durationMonths?: number;
  incomeReplacementRate?: number;
  monthlyExpenseChange?: number;

  // Child born
  childName?: string;
  childMonthlyExpense?: number;
  childCareArrangements?: ChildcareArrangement[];

  // Partner change
  partnerActive?: boolean;

  // Cash-flow events
  cashAmount?: number;

  // Property purchase
  propertyId?: string;
  propertyLabel?: string;
  propertyValue?: number;
  propertyWozValue?: number;
  propertyAppreciationRate?: number;
  propertyOwnerOccupied?: boolean;
  propertyRentalIncome?: number;
  propertyPurchaseCosts?: number;
  propertyMortgages?: MortgageConfig[];

  // Property sale
  salePrice?: number;
  sellingCosts?: number;

  // Legacy generic payloads kept for migration of saved files.
  amount?: number;
}

// ---- Simulation Results ----

export interface SimulationResult {
  months: MonthlySnapshot[];
  annualSummaries: AnnualSummary[];
  fireDate: string | null;
  fireAge: number | null;
  fireNumber: number;
  coastFireAge: number | null;
  coastFireNumber: number;
  yearsToFire: number | null;
  currentNetWorth: number;
  currentLiquidNetWorth: number;
  projectedNetWorthAtRetirement: number;
  savingsRate: number;
  retirementReadiness: 'ahead' | 'on-track' | 'behind';
}

export interface MonthlySnapshot {
  date: string;
  month: number;       // months from start
  age: number;
  grossIncome: number;
  netIncome: number;
  totalExpenses: number;
  mortgagePayment: number;
  mortgageInterest: number;
  mortgagePrincipalPayment: number;
  savings: number;
  investmentValue: number;
  investmentGains: number;
  propertyValue: number;
  mortgageBalance: number;
  netWorth: number;
  liquidNetWorth: number;
  savingsRate: number;
  cashBalance: number;
  toeslagenIncome: number;
  isRetired: boolean;
}

export interface PartnerTaxBreakdown {
  grossIncome: number;
  incomeTax: number;
  generalCredit: number;
  labourCredit: number;
  iackCredit: number;
  ouderenCredit: number;
  jonggehandicaptCredit: number;
  zvw: number;
  netIncome: number;
  effectiveRate: number;
  lijfrenteDeduction: number;
  hillenRelief: number;
  giftenDeduction: number;
  alimentatieDeduction: number;
  selfEmploymentDeduction: number;
  box2Tax: number;
}

export interface AnnualSummary {
  year: number;
  age: number;
  grossIncome: number;
  taxBox1: number;
  taxBox3: number;
  taxCredits: number;
  netIncome: number;
  totalExpenses: number;
  totalScheduledMortgagePayments: number;
  totalExtraMortgageRepayments: number;
  totalMortgagePayments: number;
  totalCashContributions: number;
  totalInvestmentContributions: number;
  cashReturns: number;
  investmentReturns: number;
  endNetWorth: number;
  endLiquidNetWorth: number;
  endInvestmentValue: number;
  endTaxableInvestmentValue: number;
  endPropertyValue: number;
  endMortgageBalance: number;
  endCashBalance: number;
  totalToeslagen: number;
  savingsRate: number;
  effectiveTaxRate: number;
  /** Per-partner tax breakdown (populated when filing as couple) */
  primaryTax?: PartnerTaxBreakdown;
  partnerTax?: PartnerTaxBreakdown;
  /** Actual annual mortgage interest used in tax calculation (declining with amortisation) */
  mortgageInterestDeduction: number;
  /** Eigenwoningforfait for the year */
  eigenwoningforfait: number;
  /** Box 3 eligible property value (non-owner-occupied only) */
  box3PropertyValue: number;
  /** Box 3 eligible mortgage debt (non-owner-occupied only) */
  box3MortgageDebt: number;
}
