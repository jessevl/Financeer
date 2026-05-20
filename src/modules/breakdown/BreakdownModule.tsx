import { useSimulation } from '@/hooks/useSimulation';
import { useActiveScenario } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ModuleHint } from '@/components/common/ModuleHint';
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';

function Row({
  label,
  value,
  sub,
  bold,
  accent,
  dimmed,
  negative,
}: {
  label: string;
  value: string;
  sub?: boolean;
  bold?: boolean;
  accent?: boolean;
  dimmed?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between py-0.5 text-sm',
        sub && 'pl-4 text-xs',
        bold && 'font-semibold',
        accent && 'text-[var(--color-accent-primary)]',
        dimmed && 'text-muted-foreground',
        negative && 'text-red-600 dark:text-red-400',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Sep() {
  return <div className="border-b border-dashed border-muted-foreground/20 my-1" />;
}

function YearCard({ year, index }: { year: ReturnType<typeof useSimulation>['annualSummaries'][0]; index: number }) {
  const [expanded, setExpanded] = useState(index < 3);
  const sim = useSimulation();

  const totalInflows = year.netIncome + year.totalToeslagen;
  const totalOutflows = year.totalExpenses + year.totalMortgagePayments + year.totalCashContributions + year.totalInvestmentContributions;
  const netCashFlow = totalInflows - totalOutflows;
  const isFireYear = sim.fireAge !== null && Math.floor(sim.fireAge) === year.age;

  return (
    <Card className={cn(isFireYear && 'border-orange-400 dark:border-orange-600')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className="text-base flex items-center gap-2">
                {year.year}
                <span className="text-sm font-normal text-muted-foreground">
                  (age {year.age})
                </span>
                {isFireYear && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                    <Flame className="h-3 w-3" /> FIRE
                  </span>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                {netCashFlow >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                )}
                <span className={cn('font-medium', netCashFlow >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatCurrency(netCashFlow)}
                </span>
              </div>
              <div className="text-muted-foreground">
                Liquid NW: <span className="font-medium text-foreground">{formatCurrency(year.endLiquidNetWorth)}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Income & Tax */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Income & Tax
              </h4>
              <Row label="Gross income" value={formatCurrency(year.grossIncome)} />
              <Row label="Box 1 tax" value={`- ${formatCurrency(year.taxBox1)}`} sub />
              <Row label="Tax credits" value={`+ ${formatCurrency(year.taxCredits)}`} sub />
              {year.taxBox3 > 0 && (
                <Row label="Box 3 wealth tax" value={`- ${formatCurrency(year.taxBox3)}`} sub />
              )}
              <Sep />
              <Row label="Net income" value={formatCurrency(year.netIncome)} bold />
              <Row label={`Effective rate: ${formatPercent(year.effectiveTaxRate)}`} value="" dimmed />
              {year.totalToeslagen > 0 && (
                <>
                  <Sep />
                  <Row label="Toeslagen" value={`+ ${formatCurrency(year.totalToeslagen)}`} accent />
                </>
              )}
              <Sep />
              <Row label="Total available" value={formatCurrency(totalInflows)} bold accent />
            </div>

            {/* Column 2: Outflows */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Outflows
              </h4>
              <Row label="Living expenses" value={`- ${formatCurrency(year.totalExpenses)}`} />
              {year.totalScheduledMortgagePayments > 0 && (
                <Row label="Scheduled mortgage payments" value={`- ${formatCurrency(year.totalScheduledMortgagePayments)}`} />
              )}
              {year.totalExtraMortgageRepayments > 0 && (
                <Row label="Extra mortgage repayments" value={`- ${formatCurrency(year.totalExtraMortgageRepayments)}`} />
              )}
              {year.totalCashContributions > 0 && (
                <Row label="Cash contributions" value={`- ${formatCurrency(year.totalCashContributions)}`} />
              )}
              {year.totalInvestmentContributions > 0 && (
                <Row label="Investment contributions" value={`- ${formatCurrency(year.totalInvestmentContributions)}`} />
              )}
              <Sep />
              <Row label="Total outflows" value={formatCurrency(totalOutflows)} bold />
              <Sep />
              <Row
                label="Net cash flow"
                value={formatCurrency(netCashFlow)}
                bold
                accent={netCashFlow >= 0}
                negative={netCashFlow < 0}
              />
              <Row label={`Savings rate: ${formatPercent(year.savingsRate)}`} value="" dimmed />
            </div>

            {/* Column 3: Balance Sheet */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                End-of-Year Balance
              </h4>
              <Row label="Cash savings" value={formatCurrency(year.endCashBalance)} />
              {year.cashReturns !== 0 && <Row label="Savings interest" value={`+ ${formatCurrency(year.cashReturns)}`} sub dimmed />}
              <Row label="Invested assets" value={formatCurrency(year.endInvestmentValue)} />
              {year.investmentReturns !== 0 && <Row label="Investment returns" value={`+ ${formatCurrency(year.investmentReturns)}`} sub dimmed />}
              {year.endPropertyValue > 0 && (
                <>
                  <Row label="Property value" value={formatCurrency(year.endPropertyValue)} />
                  <Row label="Mortgage balance" value={`- ${formatCurrency(year.endMortgageBalance)}`} />
                </>
              )}
              <Sep />
              <Row label="Liquid net worth" value={formatCurrency(year.endLiquidNetWorth)} bold accent />
              <Row label="Total incl. home" value={formatCurrency(year.endNetWorth)} bold />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function BreakdownModule() {
  const sim = useSimulation();
  const scenario = useActiveScenario();

  // Group summaries into decades
  const decades = new Map<string, typeof sim.annualSummaries>();
  for (const year of sim.annualSummaries) {
    const decadeStart = Math.floor(year.year / 10) * 10;
    const label = `${decadeStart}s`;
    if (!decades.has(label)) decades.set(label, []);
    decades.get(label)!.push(year);
  }

  // Key milestones
  const currentYear = new Date().getFullYear();
  const retirementYear = sim.annualSummaries.find(
    (y) => y.age >= scenario.retirement.targetAge
  );
  const fireYear = sim.fireAge
    ? sim.annualSummaries.find((y) => y.age >= Math.floor(sim.fireAge!))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Annual Breakdown</h2>
        <p className="text-muted-foreground mt-1">
          Year-by-year financial summary showing how income flows through tax, expenses, and savings into your liquid net worth first, with total net worth shown second.
        </p>
      </div>

      <ModuleHint id="breakdown">
        Each row shows one simulated year. Columns cover gross income, tax paid, net income, expenses, cash savings, invested assets, and cumulative liquid net worth. Total net worth including your home is still shown as a secondary figure. Use this table to verify the simulation matches your expectations and spot trends over time. Figures are estimates and we cannot guarantee correctness.
      </ModuleHint>

      {/* Quick summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Current Year</p>
            <p className="text-lg font-bold mt-1">{currentYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Years Simulated</p>
            <p className="text-lg font-bold mt-1">{sim.annualSummaries.length}</p>
          </CardContent>
        </Card>
        {sim.fireAge && (
          <Card className="border-orange-400/50">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">FIRE Year</p>
              <p className="text-lg font-bold mt-1 text-orange-600">
                {fireYear?.year ?? '—'} (age {Math.floor(sim.fireAge)})
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Retirement Year</p>
            <p className="text-lg font-bold mt-1">
              {retirementYear?.year ?? '—'} (age {scenario.retirement.targetAge})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Flow explanation */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="px-2 py-1 rounded bg-muted">Gross Income</span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-2 py-1 rounded bg-muted">− Tax</span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-2 py-1 rounded bg-muted">+ Toeslagen</span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-2 py-1 rounded bg-muted">− Expenses & Mortgage</span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-2 py-1 rounded bg-muted">− Invest</span>
        <ArrowRight className="h-3 w-3" />
        <span className="px-2 py-1 rounded bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] font-medium">Liquid Net Worth</span>
      </div>

      {/* Year cards */}
      <div className="space-y-2">
        {sim.annualSummaries.map((year, index) => (
          <YearCard key={year.year} year={year} index={index} />
        ))}
      </div>
    </div>
  );
}
