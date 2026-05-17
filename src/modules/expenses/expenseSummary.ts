import type { ChildcareArrangement, ExpenseConfig, ExpenseItem } from '@/types';
import { getChildAgeYears, getChildcareArrangements } from '@/lib/childcare';

export interface ChildExpenseDetail {
  name: string;
  age: number;
  bracket: string;
  base: number;
  multiplier: number;
  monthly: number;
  arrangements: Array<ChildcareArrangement & { monthlyCost: number }>;
  koMonthly: number;
}

export interface ExpenseSummary {
  monthlyFixed: number;
  monthlyVariable: number;
  annualTotal: number;
  annualMonthly: number;
  healthcareAnnual: number;
  healthcareMonthly: number;
  totalChildMonthly: number;
  totalMonthly: number;
  totalAnnual: number;
  childDetails: ChildExpenseDetail[];
  categoryRows: Array<{ label: string; amount: number }>;
}

export function summarizeExpenses(
  expenses: ExpenseConfig,
  isCoupleHousehold: boolean,
  currentDate = new Date(),
): ExpenseSummary {
  const monthlyFixed = expenses.monthlyFixed.reduce((sum, item) => sum + item.amount, 0);
  const monthlyVariable = expenses.monthlyVariable.reduce((sum, item) => sum + item.amount, 0);
  const annualTotal = expenses.annualExpenses.reduce((sum, item) => sum + item.amount, 0);
  const annualMonthly = annualTotal / 12;

  const healthcareAnnual =
    expenses.healthcareMonthlyPremium * 12 +
    expenses.healthcareDeductible +
    (isCoupleHousehold
      ? ((expenses.partnerHealthcareMonthlyPremium ?? 0) * 12) + (expenses.partnerHealthcareDeductible ?? 0)
      : 0);
  const healthcareMonthly = healthcareAnnual / 12;

  const childDetails = expenses.children.map((child) => {
    const age = Math.floor(getChildAgeYears(child, currentDate));
    let multiplier = 1.0;
    let bracket = '0-3';
    if (age >= 18) {
      multiplier = 0.8;
      bracket = '18-23';
    } else if (age >= 12) {
      multiplier = 1.5;
      bracket = '12-17';
    } else if (age >= 4) {
      multiplier = 1.2;
      bracket = '4-11';
    }

    const arrangements = getChildcareArrangements(child).map((arrangement) => ({
      ...arrangement,
      monthlyCost: arrangement.hoursPerMonth * arrangement.hourlyRate,
    }));
    const koMonthly = arrangements.reduce((sum, arrangement) => sum + arrangement.monthlyCost, 0);

    return {
      name: child.name || 'Child',
      age,
      bracket,
      base: child.monthlyExpense,
      multiplier,
      monthly: child.monthlyExpense * multiplier,
      arrangements,
      koMonthly,
    };
  });
  const totalChildMonthly = childDetails.reduce((sum, child) => sum + child.monthly + child.koMonthly, 0);

  const categoryMap = new Map<string, number>();
  const addItems = (items: ExpenseItem[], monthlyFactor: number) => {
    for (const item of items) {
      const label = item.category?.trim() || 'Uncategorized';
      categoryMap.set(label, (categoryMap.get(label) ?? 0) + item.amount * monthlyFactor);
    }
  };

  addItems(expenses.monthlyFixed, 1);
  addItems(expenses.monthlyVariable, 1);
  addItems(expenses.annualExpenses, 1 / 12);

  if (healthcareMonthly > 0) {
    categoryMap.set('Healthcare', (categoryMap.get('Healthcare') ?? 0) + healthcareMonthly);
  }
  if (totalChildMonthly > 0) {
    categoryMap.set('Children & childcare', (categoryMap.get('Children & childcare') ?? 0) + totalChildMonthly);
  }

  const totalMonthly = monthlyFixed + monthlyVariable + annualMonthly + healthcareMonthly + totalChildMonthly;

  return {
    monthlyFixed,
    monthlyVariable,
    annualTotal,
    annualMonthly,
    healthcareAnnual,
    healthcareMonthly,
    totalChildMonthly,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    childDetails,
    categoryRows: [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount]) => ({ label, amount })),
  };
}