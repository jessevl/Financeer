import type { TaxConfig, TaxBracket, Box2Config } from '@/types';

/**
 * Calculate Box 1 income tax (progressive brackets)
 */
export function calculateBox1Tax(taxableIncome: number, brackets: TaxBracket[]): number {
  let remaining = Math.max(0, taxableIncome);
  let tax = 0;
  let prevLimit = 0;

  for (const bracket of brackets) {
    const upper = bracket.upperLimit ?? Infinity;
    const bracketSize = upper - prevLimit;
    const taxable = Math.min(remaining, bracketSize);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = upper;
    if (remaining <= 0) break;
  }

  return tax;
}

/**
 * Calculate Box 2 tax (income from substantial interest, two-bracket system)
 * Lower bracket: e.g. first €67k @ 24.5%, remainder @ 33%
 * For couples (filing together), the bracket limit doubles.
 */
export function calculateBox2Tax(box2Income: number, box2: Box2Config, isCoupleFilingJointly = false): number {
  if (box2Income <= 0) return 0;
  const bracketLimit = isCoupleFilingJointly ? box2.lowerBracketLimit * 2 : box2.lowerBracketLimit;
  const lowerPortion = Math.min(box2Income, bracketLimit);
  const upperPortion = Math.max(0, box2Income - bracketLimit);
  return lowerPortion * box2.lowerRate + upperPortion * box2.upperRate;
}

/**
 * Calculate general tax credit (algemene heffingskorting)
 * Phases out linearly between phaseOutStart and phaseOutEnd
 */
export function calculateGeneralTaxCredit(taxableIncome: number, config: TaxConfig): number {
  const { maxAmount, phaseOutStart, phaseOutEnd } = config.generalTaxCredit;

  if (taxableIncome <= phaseOutStart) return maxAmount;
  if (taxableIncome >= phaseOutEnd) return 0;

  const phaseOutRange = phaseOutEnd - phaseOutStart;
  const excess = taxableIncome - phaseOutStart;
  const reduction = (excess / phaseOutRange) * maxAmount;
  return Math.max(0, maxAmount - reduction);
}

/**
 * Calculate labour tax credit (arbeidskorting)
 * Supports multi-segment build-up (official NL formula) or simplified linear build-up.
 * Phases out from phaseOutStart to phaseOutEnd.
 * If minAmount is set, the credit floors at that value above phaseOutEnd.
 */
export function calculateLabourTaxCredit(taxableIncome: number, config: TaxConfig): number {
  const {
    maxAmount,
    buildUpStart = 0,
    buildUpEnd = 0,
    phaseOutStart,
    phaseOutEnd,
    minAmount = 0,
    buildUpSegments,
  } = config.labourTaxCredit;

  if (taxableIncome <= buildUpStart) return 0;

  // Build-up phase
  if (taxableIncome <= buildUpEnd) {
    // Multi-segment build-up (official formula)
    if (buildUpSegments && buildUpSegments.length > 0) {
      let segStart = buildUpStart;
      for (const seg of buildUpSegments) {
        if (taxableIncome <= seg.upTo) {
          return Math.min(maxAmount, seg.baseAmount + seg.rate * (taxableIncome - segStart));
        }
        segStart = seg.upTo;
      }
      // Past all segments but below buildUpEnd — return max
      return maxAmount;
    }

    // Simplified linear build-up (fallback)
    const buildUpRange = buildUpEnd - buildUpStart;
    if (buildUpRange <= 0) return maxAmount;
    const progress = (taxableIncome - buildUpStart) / buildUpRange;
    return maxAmount * progress;
  }

  // Plateau between buildUpEnd and phaseOutStart
  if (taxableIncome <= phaseOutStart) return maxAmount;

  // Phase-out
  if (taxableIncome >= phaseOutEnd) return minAmount;

  const phaseOutRange = phaseOutEnd - phaseOutStart;
  const excess = taxableIncome - phaseOutStart;
  const reduction = (excess / phaseOutRange) * (maxAmount - minAmount);
  return Math.max(minAmount, maxAmount - reduction);
}

/**
 * Calculate IACK (Inkomensafhankelijke combinatiekorting)
 * For working parents with youngest child under 12
 * Builds up from incomeThreshold at buildUpRate, capped at maxAmount
 */
export function calculateIACK(workIncome: number, config: TaxConfig, hasChildUnder12: boolean): number {
  if (!hasChildUnder12) return 0;
  const { maxAmount, incomeThreshold, buildUpRate } = config.iack;
  if (workIncome <= incomeThreshold) return 0;
  return Math.min(maxAmount, (workIncome - incomeThreshold) * buildUpRate);
}

/**
 * Calculate ouderenkorting (elderly tax credit)
 * Available once AOW age is reached; phases out above phaseOutStart
 */
export function calculateOuderenkorting(
  taxableIncome: number,
  config: TaxConfig,
  isAOWAge: boolean,
  isSingle: boolean,
): number {
  if (!isAOWAge) return 0;
  const { maxAmount, phaseOutStart, phaseOutRate, alleenstaandAmount } = config.ouderenkorting;

  let credit = maxAmount;
  if (taxableIncome > phaseOutStart) {
    const reduction = (taxableIncome - phaseOutStart) * phaseOutRate;
    credit = Math.max(0, maxAmount - reduction);
  }

  // Alleenstaande ouderenkorting — fixed addition for singles
  if (isSingle) {
    credit += alleenstaandAmount;
  }

  return credit;
}

/**
 * Calculate jaarruimte (maximum annual lijfrente deduction)
 */
export function calculateJaarruimte(grossIncome: number, config: TaxConfig): number {
  const opt = config.taxOptimizations;
  const cappedIncome = Math.min(grossIncome, opt.jaarruimteMaxIncome);
  const base = Math.max(0, cappedIncome - opt.jaarruimteThreshold);
  const jaarruimte = Math.min(opt.jaarruimteMax, base * opt.jaarruimtePercent - opt.factorA);
  return Math.max(0, jaarruimte);
}

/**
 * Calculate lijfrente deduction (capped at jaarruimte)
 */
export function calculateLijfrenteDeduction(grossIncome: number, config: TaxConfig): number {
  const jaarruimte = calculateJaarruimte(grossIncome, config);
  return Math.min(config.taxOptimizations.lijfrenteAnnualContribution, jaarruimte);
}

/**
 * Calculate Hillen arrangement relief
 * When eigenwoningforfait > mortgage interest, the excess used to be tax-free
 * Being phased out over 30 years (2019–2048)
 */
export function calculateHillenRelief(
  eigenwoningforfait: number,
  mortgageInterest: number,
  currentYear: number,
  config: TaxConfig,
): number {
  const opt = config.taxOptimizations;
  if (!opt.hillenEnabled) return 0;

  // Hillen only applies when EWF > mortgage interest
  const excess = eigenwoningforfait - mortgageInterest;
  if (excess <= 0) return 0;

  // Phase-out: linear reduction from 100% to 0% over hillenPhaseOutYears starting hillenStartYear
  const yearsElapsed = currentYear - opt.hillenStartYear;
  const remainingFactor = Math.max(0, 1 - yearsElapsed / opt.hillenPhaseOutYears);

  return excess * remainingFactor;
}

/**
 * Calculate giftenaftrek (charitable giving deduction)
 */
export function calculateGiftenaftrek(taxableIncome: number, config: TaxConfig): number {
  const opt = config.taxOptimizations;

  // Periodieke giften are fully deductible
  let deduction = opt.giftenPeriodiek;

  // Regular giften: deductible above threshold (1% income), max 10% income
  const threshold = taxableIncome * opt.giftenThresholdPercent;
  const maxRegular = taxableIncome * opt.giftenMaxPercent;
  const regularDeductible = Math.min(maxRegular, Math.max(0, opt.giftenRegular - threshold));
  deduction += regularDeductible;

  return deduction;
}

/**
 * Calculate ZVW (healthcare insurance) contribution
 */
export function calculateZVW(taxableIncome: number, config: TaxConfig): number {
  const base = Math.min(taxableIncome, config.socialContributions.zvwMaxIncome);
  return base * config.socialContributions.zvwRate;
}

/**
 * Calculate Box 3 wealth tax
 */
export function calculateBox3Tax(
  savingsBalance: number,
  investmentBalance: number,
  debts: number,
  config: TaxConfig,
  isCouple: boolean,
  /** Investment property values — taxed as "beleggingen" in box 3 */
  otherAssets: number = 0,
): number {
  const opt = config.taxOptimizations;
  const persons = isCouple ? 2 : 1;
  const freeThreshold = config.box3.freeThreshold * persons;

  // Green investments exemption
  const greenExemption = Math.min(
    opt.greenInvestments,
    opt.greenExemptionPerPerson * persons,
  );
  const adjustedInvestments = Math.max(0, investmentBalance + otherAssets - greenExemption);

  // Schuldendrempel: debts below threshold per person are ignored
  const debtThreshold = (config.box3.debtThreshold ?? 3700) * persons;
  const effectiveDebts = debts > debtThreshold ? debts - debtThreshold : 0;

  // Grondslag sparen en beleggen
  const grondslag = savingsBalance + adjustedInvestments - effectiveDebts;

  if (grondslag <= freeThreshold) return 0;

  const taxableWealth = grondslag - freeThreshold;

  // 2023+ category-based fictional return (rendement per vermogenscategorie)
  // Each category contributes proportionally to the total fictional return
  const totalAssets = savingsBalance + adjustedInvestments;
  if (totalAssets === 0 && effectiveDebts === 0) return 0;

  const fictionalReturn =
    savingsBalance * config.box3.savingsRate +
    adjustedInvestments * config.box3.investmentRate -
    effectiveDebts * config.box3.debtRate;

  // Proportional: taxable portion of fictional return
  const effectiveFictionalReturn = grondslag > 0
    ? (fictionalReturn / grondslag) * taxableWealth
    : 0;

  let tax = Math.max(0, effectiveFictionalReturn) * config.box3.taxRate;

  // Green investments tax credit (0.7% of green investment amount, capped at actual tax)
  if (opt.greenInvestments > 0) {
    const greenCredit = Math.min(greenExemption, opt.greenInvestments) * opt.greenTaxCredit;
    tax = Math.max(0, tax - greenCredit);
  }

  return tax;
}

/**
 * Calculate eigenwoningforfait (deemed rental value for tax)
 * Standard rate up to threshold; excess at 2.35% for properties > threshold
 */
export function calculateEigenwoningforfait(wozValue: number, config: TaxConfig): number {
  if (wozValue <= 0) return 0;
  if (wozValue <= config.eigenwoningforfaitThreshold) {
    return wozValue * config.eigenwoningforfaitRate;
  }
  // Base amount for the threshold portion
  const base = config.eigenwoningforfaitThreshold * config.eigenwoningforfaitRate;
  // Excess at higher rate (2.35%)
  const excess = (wozValue - config.eigenwoningforfaitThreshold) * 0.0235;
  return base + excess;
}

/**
 * Full annual tax calculation: gross income -> net income
 * Incorporates all deductions: mortgage interest, lijfrente, Hillen relief, giftenaftrek
 */
export function calculateAnnualNetIncome(
  grossIncome: number,
  mortgageInterest: number,
  eigenwoningforfait: number,
  config: TaxConfig,
  options?: {
    labourIncome?: number;
    hasChildUnder12?: boolean;
    isAOWAge?: boolean;
    isSingle?: boolean;
    isJonggehandicapt?: boolean;
    currentYear?: number;
    box2Income?: number;
    hasSelfEmployment?: boolean;
  },
): {
  netIncome: number;
  incomeTax: number;
  box2Tax: number;
  generalCredit: number;
  labourCredit: number;
  iackCredit: number;
  ouderenCredit: number;
  jonggehandicaptCredit: number;
  zvw: number;
  effectiveRate: number;
  lijfrenteDeduction: number;
  hillenRelief: number;
  giftenDeduction: number;
  alimentatieDeduction: number;
  selfEmploymentDeduction: number;
} {
  const {
    labourIncome = grossIncome,
    hasChildUnder12 = false,
    isAOWAge = false,
    isSingle = true,
    isJonggehandicapt = false,
    currentYear = new Date().getFullYear(),
    box2Income = 0,
    hasSelfEmployment = false,
  } = options ?? {};

  // Lijfrente deduction (capped at jaarruimte)
  const lijfrenteDeduction = calculateLijfrenteDeduction(grossIncome, config);

  // Housing: eigenwoningforfait is added to income, mortgage interest is deducted
  // Net housing impact: EWF - interest (positive = adds income, negative = deduction)
  let netHousingImpact = eigenwoningforfait - mortgageInterest;

  // Hillen relief: when EWF > interest, the excess is (partially) relieved
  let hillenRelief = 0;
  if (netHousingImpact > 0) {
    hillenRelief = calculateHillenRelief(eigenwoningforfait, mortgageInterest, currentYear, config);
    netHousingImpact = Math.max(0, netHousingImpact - hillenRelief);
  }

  // Box 1 taxable income: gross + housing impact - lijfrente
  const incomeBeforeGiften = Math.max(0, grossIncome + netHousingImpact - lijfrenteDeduction);

  // Self-employment deductions (zelfstandigenaftrek + startersaftrek + MKB-winstvrijstelling)
  let selfEmploymentDeduction = 0;
  if (hasSelfEmployment && config.selfEmployment) {
    const se = config.selfEmployment;
    let deduction = se.zelfstandigenaftrek;
    if (se.isStarter) deduction += se.startersaftrek;
    // MKB-winstvrijstelling: percentage of profit after zelfstandigenaftrek
    const profitAfterZA = Math.max(0, incomeBeforeGiften - deduction);
    const mkbVrijstelling = profitAfterZA * se.mkbWinstvrijstelling;
    selfEmploymentDeduction = deduction + mkbVrijstelling;
  }

  // Giftenaftrek (thresholds based on income before giften deduction)
  const giftenDeduction = calculateGiftenaftrek(incomeBeforeGiften, config);

  // Alimentatie (spousal alimony) — fully deductible from Box 1
  const alimentatieDeduction = Math.max(0, config.taxOptimizations?.alimentatie ?? 0);

  const taxableIncome = Math.max(0, incomeBeforeGiften - giftenDeduction - alimentatieDeduction - selfEmploymentDeduction);

  // Calculate tax & credits
  const incomeTax = calculateBox1Tax(taxableIncome, config.box1Brackets);
  const generalCredit = calculateGeneralTaxCredit(taxableIncome, config);
  const labourCredit = calculateLabourTaxCredit(Math.max(0, labourIncome), config);
  const iackCredit = calculateIACK(Math.max(0, labourIncome), config, hasChildUnder12);
  const ouderenCredit = calculateOuderenkorting(taxableIncome, config, isAOWAge, isSingle);
  const jonggehandicaptCredit = isJonggehandicapt ? config.jonggehandicaptenkorting : 0;
  const zvw = calculateZVW(grossIncome, config);

  const totalCredits = generalCredit + labourCredit + iackCredit + ouderenCredit + jonggehandicaptCredit;
  const box2Tax = calculateBox2Tax(box2Income, config.box2, config.filingType === 'couple');
  const totalTax = Math.max(0, incomeTax - totalCredits) + zvw + box2Tax;
  const totalGross = grossIncome + box2Income;
  const netIncome = totalGross - totalTax;
  const effectiveRate = totalGross > 0 ? totalTax / totalGross : 0;

  return {
    netIncome, incomeTax, box2Tax, generalCredit, labourCredit, iackCredit, ouderenCredit, jonggehandicaptCredit,
    zvw, effectiveRate, lijfrenteDeduction, hillenRelief, giftenDeduction, alimentatieDeduction, selfEmploymentDeduction,
  };
}

/**
 * Fiscaal partnerschap optimizer
 * For fiscal partners, optimally allocate Box 3 assets and mortgage interest
 * deduction between partners to minimize combined tax.
 *
 * Tests 11 splits (0% to 100% in 10% steps) and returns the optimal allocation.
 */
export function optimizeFiscaalPartnerschap(
  primaryGross: number,
  partnerGross: number,
  mortgageInterest: number,
  eigenwoningforfait: number,
  config: TaxConfig,
  box3Data: {
    savings: number;
    investments: number;
    debts: number;
    otherAssets?: number;
  },
  options?: {
    currentYear?: number;
    box2Income?: number;
  },
): {
  optimalPrimarySplit: number;    // 0..1 — percentage of Box 3 assigned to primary
  optimalMortgageSplit: number;   // 0..1 — percentage of mortgage deduction to primary
  totalTaxDefault: number;        // tax with 50/50 split
  totalTaxOptimized: number;      // tax with optimal split
  taxSavings: number;
} {
  const { currentYear = new Date().getFullYear(), box2Income = 0 } = options ?? {};

  const calcCombinedTax = (box3PrimaryFraction: number, mortgagePrimaryFraction: number) => {
    // Box 1 for each partner
    const primaryMortgage = mortgageInterest * mortgagePrimaryFraction;
    const partnerMortgage = mortgageInterest * (1 - mortgagePrimaryFraction);
    const primaryEwf = eigenwoningforfait * mortgagePrimaryFraction;
    const partnerEwf = eigenwoningforfait * (1 - mortgagePrimaryFraction);

    const primaryTax = calculateAnnualNetIncome(primaryGross, primaryMortgage, primaryEwf, config, {
      isSingle: false, currentYear, box2Income,
    });
    const partnerTax = calculateAnnualNetIncome(partnerGross, partnerMortgage, partnerEwf, config, {
      isSingle: false, currentYear, box2Income: 0,
    });

    // Box 3 for each partner
    const pFrac = box3PrimaryFraction;
    const primaryBox3 = calculateBox3Tax(
      box3Data.savings * pFrac,
      box3Data.investments * pFrac,
      box3Data.debts * pFrac,
      config,
      false, // calculate per person
      (box3Data.otherAssets ?? 0) * pFrac,
    );
    const partnerBox3 = calculateBox3Tax(
      box3Data.savings * (1 - pFrac),
      box3Data.investments * (1 - pFrac),
      box3Data.debts * (1 - pFrac),
      config,
      false,
      (box3Data.otherAssets ?? 0) * (1 - pFrac),
    );

    const totalTax =
      (primaryGross - primaryTax.netIncome) +
      (partnerGross - partnerTax.netIncome) +
      primaryBox3 + partnerBox3;

    return totalTax;
  };

  // Test 11 x 11 combinations (box3 split x mortgage split)
  let bestBox3 = 0.5;
  let bestMortgage = 1; // default: 100% to primary
  let bestTax = Infinity;

  for (let b3 = 0; b3 <= 10; b3++) {
    for (let mt = 0; mt <= 10; mt++) {
      const b3Frac = b3 / 10;
      const mtFrac = mt / 10;
      const t = calcCombinedTax(b3Frac, mtFrac);
      if (t < bestTax) {
        bestTax = t;
        bestBox3 = b3Frac;
        bestMortgage = mtFrac;
      }
    }
  }

  const defaultTax = calcCombinedTax(0.5, 1);

  return {
    optimalPrimarySplit: bestBox3,
    optimalMortgageSplit: bestMortgage,
    totalTaxDefault: defaultTax,
    totalTaxOptimized: bestTax,
    taxSavings: Math.max(0, defaultTax - bestTax),
  };
}

/**
 * Compare rental property tax: Box 3 (private) vs BV (corporate + Box 2)
 *
 * Box 3: property value is taxed using fictional return system
 * BV: rental profit is taxed at VPB (corporate tax), then dividend at Box 2 rates
 */
export function compareRentalBox3vsBV(
  propertyValue: number,
  annualRentalIncome: number,
  annualExpenses: number,       // maintenance, management, insurance, etc.
  mortgageDebt: number,
  mortgageInterest: number,     // annual interest on the mortgage
  config: TaxConfig,
  isCouple: boolean,
): {
  box3: { annualTax: number; effectiveRate: number; netIncome: number };
  bv: { vpbTax: number; netProfit: number; box2Tax: number; totalTax: number; effectiveRate: number; netIncome: number };
  advantage: 'box3' | 'bv' | 'neutral';
  difference: number;           // positive = BV is cheaper by this amount
} {
  // ---- Box 3 scenario ----
  // Property value taxed as investment in Box 3 (fictional return)
  // Mortgage debt reduces the box 3 grondslag
  // Actual rental income is tax-free (only fictional return is taxed)
  const box3Tax = calculateBox3Tax(
    0,                 // no savings portion
    0,                 // investments handled via otherAssets
    mortgageDebt,
    config,
    isCouple,
    propertyValue,     // property as otherAssets
  );
  const box3NetIncome = annualRentalIncome - annualExpenses - mortgageInterest - box3Tax;
  const box3EffRate = annualRentalIncome > 0 ? box3Tax / annualRentalIncome : 0;

  // ---- BV scenario ----
  // Corporate tax (VPB) on rental profit
  const rentalProfit = annualRentalIncome - annualExpenses - mortgageInterest;
  // Dutch VPB 2025: 19% on first €200k, 25.8% above
  const vpbLowerBracket = 200000;
  const vpbLowerRate = 0.19;
  const vpbUpperRate = 0.258;
  const vpbTax = rentalProfit > 0
    ? Math.min(rentalProfit, vpbLowerBracket) * vpbLowerRate +
      Math.max(0, rentalProfit - vpbLowerBracket) * vpbUpperRate
    : 0;

  const netProfitAfterVPB = Math.max(0, rentalProfit - vpbTax);

  // Box 2 tax on dividend (assuming full distribution)
  const box2Tax = calculateBox2Tax(netProfitAfterVPB, config.box2, isCouple);

  const bvTotalTax = vpbTax + box2Tax;
  const bvNetIncome = annualRentalIncome - annualExpenses - mortgageInterest - bvTotalTax;
  const bvEffRate = annualRentalIncome > 0 ? bvTotalTax / annualRentalIncome : 0;

  const difference = box3Tax - bvTotalTax; // positive = BV is cheaper

  return {
    box3: { annualTax: box3Tax, effectiveRate: box3EffRate, netIncome: box3NetIncome },
    bv: { vpbTax, netProfit: netProfitAfterVPB, box2Tax, totalTax: bvTotalTax, effectiveRate: bvEffRate, netIncome: bvNetIncome },
    advantage: difference > 100 ? 'bv' : difference < -100 ? 'box3' : 'neutral',
    difference,
  };
}
