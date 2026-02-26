import type { ToeslagenConfig, ChildConfig } from '@/types';

/**
 * Get max hourly rate for a given childcare type
 */
function getMaxHourlyRate(
  type: 'daycare' | 'bso' | 'gastouder',
  config: ToeslagenConfig,
): number {
  const kot = config.kinderopvangtoeslag;
  switch (type) {
    case 'daycare': return kot.maxHourlyRateDaycare;
    case 'bso': return kot.maxHourlyRateBso;
    case 'gastouder': return kot.maxHourlyRateGastouder;
  }
}

/**
 * Calculate reimbursement percentage based on household income
 * Uses a linear interpolation between max% (low income) and min% (high income)
 */
function getReimbursementPercentage(
  toetsingsinkomen: number,
  isFirstChild: boolean,
  config: ToeslagenConfig,
): number {
  const kot = config.kinderopvangtoeslag;
  const basePct = isFirstChild ? kot.firstChildPercentage : kot.secondChildPercentage;

  if (toetsingsinkomen <= kot.incomeThresholdLow) return kot.maxPercentage;
  if (toetsingsinkomen >= kot.incomeThresholdHigh) return kot.minPercentage;

  // Linear interpolation
  const range = kot.incomeThresholdHigh - kot.incomeThresholdLow;
  const position = (toetsingsinkomen - kot.incomeThresholdLow) / range;
  const maxPct = isFirstChild ? kot.maxPercentage : kot.maxPercentage;
  const minPct = isFirstChild ? kot.minPercentage : Math.max(kot.minPercentage, basePct * 0.7);

  return maxPct - position * (maxPct - minPct);
}

/**
 * Calculate kinderopvangtoeslag (childcare benefit)
 * Based on: household income, childcare type, hours per month, hourly rate (capped)
 */
export function calculateKinderopvangtoeslag(
  toetsingsinkomen: number,
  children: ChildConfig[],
  currentDate: Date,
  config: ToeslagenConfig,
): number {
  const kot = config.kinderopvangtoeslag;
  if (!kot.enabled) return 0;

  const childcareChildren = children.filter((c) => {
    if (c.kinderopvangType === 'none') return false;
    if (!c.birthDate) return false;
    const age = (currentDate.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 3600000);
    // Kinderopvangtoeslag: daycare up to age 4, BSO age 4-12
    if (c.kinderopvangType === 'daycare' || c.kinderopvangType === 'gastouder') {
      if (!(age >= 0 && age < 13)) return false;
    } else if (c.kinderopvangType === 'bso') {
      if (!(age >= 4 && age < 13)) return false;
    } else {
      return false;
    }
    // Check user-defined start/end date window (YYYY-MM)
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    if (c.kinderopvangStartDate && monthKey < c.kinderopvangStartDate) return false;
    if (c.kinderopvangEndDate && monthKey > c.kinderopvangEndDate) return false;
    return true;
  });

  if (childcareChildren.length === 0) return 0;

  let annualTotal = 0;

  childcareChildren.forEach((child, index) => {
    const maxRate = getMaxHourlyRate(child.kinderopvangType as 'daycare' | 'bso' | 'gastouder', config);
    const cappedRate = Math.min(child.kinderopvangHourlyRate, maxRate);
    const cappedHours = Math.min(child.kinderopvangHoursPerMonth, kot.maxHoursPerMonth);
    const annualCost = cappedRate * cappedHours * 12;
    const pct = getReimbursementPercentage(toetsingsinkomen, index === 0, config);
    annualTotal += annualCost * pct;
  });

  return annualTotal;
}

/**
 * Calculate zorgtoeslag (healthcare allowance)
 * Income-dependent; phases out as income rises above drempelinkomen
 */
export function calculateZorgtoeslag(
  toetsingsinkomen: number,
  totalWealth: number,
  isCouple: boolean,
  config: ToeslagenConfig,
): number {
  const zorg = config.zorgtoeslag;
  if (!zorg.enabled) return 0;

  // Wealth test
  const vermogensGrens = isCouple ? zorg.vermogensGrensCouple : zorg.vermogensGrensSingle;
  if (totalWealth > vermogensGrens) return 0;

  const drempelRate = isCouple ? zorg.drempelPercentageCouple : zorg.drempelPercentageSingle;
  const normpremie =
    drempelRate * zorg.drempelinkomen +
    zorg.excessPercentage * Math.max(0, toetsingsinkomen - zorg.drempelinkomen);

  const premie = isCouple ? 2 * zorg.standaardpremie : zorg.standaardpremie;
  return Math.max(0, premie - normpremie);
}

/**
 * Calculate kindgebonden budget (child budget)
 * Based on number & age of children, income, and single-parent status
 */
export function calculateKindgebondenBudget(
  toetsingsinkomen: number,
  children: ChildConfig[],
  currentDate: Date,
  isSingleParent: boolean,
  isCouple: boolean,
  config: ToeslagenConfig,
): number {
  const kgb = config.kindgebondenBudget;
  if (!kgb.enabled) return 0;
  if (children.length === 0) return 0;

  // Calculate max budget based on children ages
  let maxBudget = 0;
  let eligibleCount = 0;

  for (const child of children) {
    const childBirth = new Date(child.birthDate);
    const childAge = (currentDate.getTime() - childBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (childAge >= 0 && childAge < 18) {
      eligibleCount++;
      maxBudget += kgb.basePerChild;

      if (childAge >= 12 && childAge < 16) {
        maxBudget += kgb.supplement12to15;
      } else if (childAge >= 16 && childAge < 18) {
        maxBudget += kgb.supplement16to17;
      }
    }
  }

  if (eligibleCount === 0) return 0;

  // Single parent supplement
  if (isSingleParent) {
    maxBudget += kgb.singleParentExtra;
  }

  // Income-dependent reduction
  const threshold = isCouple
    ? kgb.drempelinkomen + kgb.coupleExtraThreshold
    : kgb.drempelinkomen;

  const reduction = kgb.reductionRate * Math.max(0, toetsingsinkomen - threshold);

  return Math.max(0, maxBudget - reduction);
}

/**
 * Calculate kinderbijslag (universal child benefit)
 * Not income-dependent — fixed quarterly amount by age bracket
 */
export function calculateKinderbijslag(
  children: ChildConfig[],
  currentDate: Date,
  config: ToeslagenConfig,
): number {
  const kb = config.kinderbijslag;
  if (!kb.enabled) return 0;

  let annualTotal = 0;

  for (const child of children) {
    const childBirth = new Date(child.birthDate);
    const childAge = (currentDate.getTime() - childBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (childAge >= 0 && childAge < 6) {
      annualTotal += kb.quarterly0to5 * 4;
    } else if (childAge >= 6 && childAge < 12) {
      annualTotal += kb.quarterly6to11 * 4;
    } else if (childAge >= 12 && childAge < 18) {
      annualTotal += kb.quarterly12to17 * 4;
    }
  }

  return annualTotal;
}

/**
 * Calculate huurtoeslag (rent allowance)
 * Simplified model: linear interpolation of normhuur between basishuur and rent ceiling
 * based on income relative to the income threshold.
 */
export function calculateHuurtoeslag(
  toetsingsinkomen: number,
  totalWealth: number,
  isCouple: boolean,
  config: ToeslagenConfig,
): number {
  const ht = config.huurtoeslag;
  if (!ht.enabled) return 0;
  if (ht.monthlyRent <= 0) return 0;

  // Rent must be between basishuur and maxHuur
  if (ht.monthlyRent <= ht.basishuur || ht.monthlyRent > ht.maxHuur) return 0;

  // Income test
  const maxInkomen = isCouple ? ht.maxInkomenCouple : ht.maxInkomenSingle;
  if (toetsingsinkomen > maxInkomen) return 0;

  // Wealth test
  if (totalWealth > ht.vermogensGrens) return 0;

  // Eligible rent is capped at aftoppingsgrens (for the bulk of the subsidy)
  const eligibleRent = Math.min(ht.monthlyRent, ht.aftoppingsgrens);

  // Normhuur (expected own contribution) scales linearly with income
  // At income = 0 → normhuur ≈ basishuur; at income = maxInkomen → normhuur ≈ eligibleRent
  const incomeRatio = Math.max(0, toetsingsinkomen) / maxInkomen;
  const normhuur = ht.basishuur + incomeRatio * (eligibleRent - ht.basishuur) * 0.65;

  // Monthly huurtoeslag
  const monthlyHuurtoeslag = Math.max(0, eligibleRent - normhuur);

  // If rent exceeds aftoppingsgrens but is below maxHuur, partial subsidy for the excess
  let extraSubsidy = 0;
  if (ht.monthlyRent > ht.aftoppingsgrens) {
    extraSubsidy = (ht.monthlyRent - ht.aftoppingsgrens) * 0.40;
  }

  return (monthlyHuurtoeslag + extraSubsidy) * 12;
}

/**
 * Calculate all toeslagen for a year
 * Returns annual amounts per toeslag + total
 */
export function calculateAnnualToeslagen(
  toetsingsinkomen: number,
  totalWealth: number,
  children: ChildConfig[],
  currentDate: Date,
  isCouple: boolean,
  isSingleParent: boolean,
  config: ToeslagenConfig,
): {
  zorgtoeslag: number;
  kindgebondenBudget: number;
  kinderbijslag: number;
  kinderopvangtoeslag: number;
  huurtoeslag: number;
  total: number;
} {
  if (!config.enabled) {
    return { zorgtoeslag: 0, kindgebondenBudget: 0, kinderbijslag: 0, kinderopvangtoeslag: 0, huurtoeslag: 0, total: 0 };
  }

  const zorgtoeslag = calculateZorgtoeslag(toetsingsinkomen, totalWealth, isCouple, config);
  const kindgebondenBudget = calculateKindgebondenBudget(
    toetsingsinkomen, children, currentDate, isSingleParent, isCouple, config,
  );
  const kinderbijslag = calculateKinderbijslag(children, currentDate, config);
  const kinderopvangtoeslag = calculateKinderopvangtoeslag(toetsingsinkomen, children, currentDate, config);
  const huurtoeslag = calculateHuurtoeslag(toetsingsinkomen, totalWealth, isCouple, config);

  const total = zorgtoeslag + kindgebondenBudget + kinderbijslag + kinderopvangtoeslag + huurtoeslag;

  return { zorgtoeslag, kindgebondenBudget, kinderbijslag, kinderopvangtoeslag, huurtoeslag, total };
}
