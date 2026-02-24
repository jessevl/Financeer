import { useMemo, useState } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { useActiveScenario } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ModuleHint } from '@/components/common/ModuleHint';
import { formatCurrency, formatPercent } from '@/lib/format';
import { generateInsights, type Insight, type InsightSeverity } from '@/lib/insights';
import {
  TrendingUp,
  Flame,
  Calendar,
  PiggyBank,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Home,
  Flag,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';

// ============================================================
// Shared chart helpers
// ============================================================

function chartCurrencyFormatter(value: number) {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

const chartColors = {
  primary: 'hsl(221, 83%, 53%)',
  investments: 'hsl(142, 71%, 45%)',
  cash: 'hsl(200, 80%, 55%)',
  property: 'hsl(35, 92%, 55%)',
  mortgage: 'hsl(0, 72%, 55%)',
  expenses: 'hsl(0, 65%, 55%)',
  income: 'hsl(142, 71%, 45%)',
  savings: 'hsl(221, 83%, 53%)',
};

// ============================================================
// Insight Card
// ============================================================

const severityConfig: Record<InsightSeverity, { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; text: string }> = {
  positive: { icon: CheckCircle2, bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
  negative: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
};

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = severityConfig[insight.severity];
  const Icon = cfg.icon;
  return (
    <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.text}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold leading-snug ${cfg.text}`}>{insight.headline}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.detail}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Collapsible Section (progressive disclosure)
// ============================================================

function CollapsibleSection({
  title,
  icon: SectionIcon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 text-base font-semibold">
          <SectionIcon className="h-4 w-4" />
          {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

// ============================================================
// Metric Card
// ============================================================

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${
            trend === 'up' ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400' :
            trend === 'down' ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' :
            'bg-muted text-muted-foreground'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardModule() {
  const sim = useSimulation();
  const scenario = useActiveScenario();

  const insights = useMemo(() => generateInsights(sim, scenario), [sim, scenario]);

  // Chart data
  const netWorthData = sim.annualSummaries.map((s) => ({
    year: s.year,
    age: s.age,
    label: `${s.year} (age ${s.age})`,
    investments: s.endInvestmentValue,
    cash: s.endCashBalance,
    property: s.endPropertyValue,
    mortgage: -s.endMortgageBalance,
    netWorth: s.endNetWorth,
    liquidNetWorth: s.endLiquidNetWorth,
    fireTarget: sim.fireNumber,
  }));

  const incomeExpenseData = sim.annualSummaries.slice(0, 30).map((s) => ({
    year: s.year,
    label: `${s.year}`,
    income: s.netIncome,
    expenses: s.totalExpenses + s.totalMortgagePayments,
    savings: s.netIncome - s.totalExpenses - s.totalMortgagePayments,
  }));

  const taxData = sim.annualSummaries.slice(0, 30).map((s) => ({
    year: s.year,
    label: `${s.year}`,
    effectiveRate: +(s.effectiveTaxRate * 100).toFixed(1),
    grossIncome: s.grossIncome,
    netIncome: s.netIncome,
  }));

  const fireProgress = sim.fireNumber > 0
    ? Math.min(100, (sim.currentLiquidNetWorth / sim.fireNumber) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* SECTION 1: Header + Status Badge                            */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of {scenario.name}</p>
        </div>
        <Badge variant={
          sim.retirementReadiness === 'ahead' ? 'default' :
          sim.retirementReadiness === 'on-track' ? 'secondary' : 'destructive'
        } className="text-sm">
          {sim.retirementReadiness === 'ahead' ? '🎯 Ahead of schedule' :
           sim.retirementReadiness === 'on-track' ? '✓ On track' : '⚠ Behind schedule'}
        </Badge>
      </div>

      <ModuleHint id="dashboard">
        This is your simulation overview. All charts and metrics update in real-time as you change inputs in the Planning sections. Use the sidebar to explore Income, Housing, Expenses, and more. Create multiple scenarios via the top bar to compare different life paths. Results are estimates for planning only, and we cannot guarantee correctness.
      </ModuleHint>

      {/* ============================================================ */}
      {/* SECTION 2: Key Metrics Rail                                  */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="FIRE Wealth"
          value={formatCurrency(sim.currentLiquidNetWorth, true)}
          subtitle={sim.currentNetWorth !== sim.currentLiquidNetWorth ? `Total incl. property: ${formatCurrency(sim.currentNetWorth, true)}` : undefined}
          icon={Wallet}
          trend="neutral"
        />
        <MetricCard
          title="FIRE Age"
          value={sim.fireAge ? `${Math.floor(sim.fireAge)}` : '—'}
          subtitle={sim.yearsToFire ? `${sim.yearsToFire.toFixed(1)} years away` : 'Target not reached'}
          icon={Flame}
          trend={sim.fireAge && sim.fireAge < scenario.retirement.targetAge ? 'up' : 'neutral'}
        />
        <MetricCard
          title="Savings Rate"
          value={formatPercent(sim.savingsRate)}
          icon={PiggyBank}
          trend={sim.savingsRate > 0.3 ? 'up' : sim.savingsRate > 0.1 ? 'neutral' : 'down'}
        />
        <MetricCard
          title="FIRE Number"
          value={formatCurrency(sim.fireNumber, true)}
          subtitle={`at ${formatPercent(scenario.retirement.safeWithdrawalRate)} SWR`}
          icon={Target}
          trend="neutral"
        />
      </div>

      {/* FIRE Progress Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="font-medium">FIRE Progress</span>
            </span>
            <span className="text-muted-foreground">{fireProgress.toFixed(1)}%</span>
          </div>
          <Progress value={fireProgress} className="h-2.5" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>{formatCurrency(sim.currentLiquidNetWorth, true)}</span>
            <span>{formatCurrency(sim.fireNumber, true)}</span>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 3: Decision Insights — What Changed / Anomalies      */}
      {/* ============================================================ */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* SECTION 4: FIRE Countdown Timeline                           */}
      {/* ============================================================ */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-1.5 text-sm font-medium mb-4">
            <Flag className="h-4 w-4 text-orange-500" />
            FIRE Countdown Timeline
          </div>
          {(() => {
            const currentAge = sim.annualSummaries[0]?.age ?? 30;
            const fireAge = sim.fireAge ? Math.floor(sim.fireAge) : null;
            const retirementAge = scenario.retirement.targetAge;
            const aowAge = scenario.retirement.aowStartAge;
            const milestones: { age: number; label: string; color: string; icon: string }[] = [
              { age: currentAge, label: 'Now', color: 'bg-blue-500', icon: '📍' },
            ];
            if (fireAge && fireAge > currentAge) milestones.push({ age: fireAge, label: 'FIRE', color: 'bg-orange-500', icon: '🔥' });
            if (retirementAge > currentAge) milestones.push({ age: retirementAge, label: 'Retire', color: 'bg-green-500', icon: '🏖️' });
            if (aowAge > currentAge) milestones.push({ age: aowAge, label: 'AOW', color: 'bg-purple-500', icon: '🏛️' });
            milestones.sort((a, b) => a.age - b.age);

            const minAge = milestones[0].age;
            const maxAge = milestones[milestones.length - 1].age + 2;
            const range = maxAge - minAge || 1;

            return (
              <div className="relative">
                <div className="h-2 rounded-full bg-muted relative">
                  <div className="absolute h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400 opacity-30" style={{ width: '100%' }} />
                </div>
                <div className="relative h-14 mt-1">
                  {milestones.map((ms, i) => {
                    const pct = ((ms.age - minAge) / range) * 100;
                    return (
                      <div key={ms.label} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${pct}%` }}>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow ${ms.color} -mt-[11px]`} />
                        <span className="text-[10px] font-bold mt-1">{ms.icon}</span>
                        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                          {ms.label} ({ms.age})
                        </span>
                        {i > 0 && (
                          <span className="text-[9px] text-muted-foreground/70">
                            +{ms.age - currentAge}y
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 5: Primary Chart — Net Worth Projection              */}
      {/* Always visible, the single most important visualisation.     */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Net Worth Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthData}>
                <defs>
                  <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.investments} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.investments} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.cash} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.cash} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="propGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.property} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.property} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 11 }} width={65} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="investments" name="Investments" stackId="1" stroke={chartColors.investments} fill="url(#investGrad)" />
                <Area type="monotone" dataKey="cash" name="Cash" stackId="1" stroke={chartColors.cash} fill="url(#cashGrad)" />
                <Area type="monotone" dataKey="property" name="Property" stackId="1" stroke={chartColors.property} fill="url(#propGrad)" />
                <Line type="monotone" dataKey="netWorth" name="Total Net Worth" stroke={chartColors.primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="liquidNetWorth" name="FIRE Wealth" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fireTarget" name="FIRE Target" stroke="hsl(0, 72%, 55%)" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 6: Deep-Dive Charts (Progressive Disclosure)         */}
      {/* Collapsed by default so the page isn't a wall of charts.     */}
      {/* ============================================================ */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide px-1">
          Deep-Dive Charts
        </h3>

        {/* Income vs Expenses */}
        <CollapsibleSection title="Income vs Expenses" icon={ArrowUpRight}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 10 }} width={55} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="income" name="Net Income" fill={chartColors.income} radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" name="Total Expenses" fill={chartColors.expenses} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleSection>

        {/* Effective Tax Rate */}
        <CollapsibleSection title="Effective Tax Rate Over Time" icon={ArrowDownRight}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={taxData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis unit="%" tick={{ fontSize: 10 }} width={45} />
                <RechartsTooltip
                  formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, 'Effective Rate']}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="effectiveRate" name="Effective Rate" stroke={chartColors.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleSection>

        {/* Annual Savings */}
        <CollapsibleSection title="Annual Savings" icon={PiggyBank}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 10 }} width={55} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="savings" name="Net Savings" fill={chartColors.savings} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleSection>

        {/* Investment Growth */}
        <CollapsibleSection title="Investment Growth" icon={TrendingUp}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sim.annualSummaries.map((s) => ({
                label: `${s.year}`,
                contributions: s.totalInvestmentContributions,
                returns: s.investmentReturns,
                totalValue: s.endInvestmentValue,
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 10 }} width={55} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="contributions" name="Contributions" fill={chartColors.cash} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="returns" name="Returns" fill={chartColors.investments} stackId="a" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="totalValue" name="Total Value" stroke={chartColors.primary} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleSection>

        {/* Mortgage Amortisation */}
        {sim.annualSummaries.some((s) => s.endMortgageBalance > 0) && (
          <CollapsibleSection title="Mortgage Balance Over Time" icon={Home}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sim.annualSummaries.filter((s) => s.endMortgageBalance > 0 || s.totalMortgagePayments > 0).map((s) => ({
                  label: `${s.year}`,
                  balance: s.endMortgageBalance,
                  payments: s.totalMortgagePayments,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 10 }} width={55} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="balance" name="Remaining Balance" fill={chartColors.mortgage} fillOpacity={0.15} stroke={chartColors.mortgage} strokeWidth={2} />
                  <Bar dataKey="payments" name="Annual Payments" fill={chartColors.cash} radius={[2, 2, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION 7: Annual Summary Table (Progressive Disclosure)     */}
      {/* ============================================================ */}
      <CollapsibleSection title="Annual Summary Table" icon={Calendar}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Year</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Age</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Gross Income</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Net Income</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Expenses</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Tax Rate</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Net Worth</th>
              </tr>
            </thead>
            <tbody>
              {sim.annualSummaries.slice(0, 40).map((s) => (
                <tr key={s.year} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-1.5 px-2 font-medium">{s.year}</td>
                  <td className="py-1.5 px-2">{s.age}</td>
                  <td className="py-1.5 px-2 text-right">{formatCurrency(s.grossIncome)}</td>
                  <td className="py-1.5 px-2 text-right">{formatCurrency(s.netIncome)}</td>
                  <td className="py-1.5 px-2 text-right">{formatCurrency(s.totalExpenses)}</td>
                  <td className="py-1.5 px-2 text-right">{formatPercent(s.effectiveTaxRate)}</td>
                  <td className="py-1.5 px-2 text-right font-medium">{formatCurrency(s.endNetWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}