import { useScenarioComparison } from '@/hooks/useScenarioComparison';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/lib/format';
import { ModuleHint } from '@/components/common/ModuleHint';
import { GitCompareArrows } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Distinct colours for up to 8 scenarios
const SCENARIO_COLORS = [
  'hsl(221, 83%, 53%)',   // blue
  'hsl(142, 71%, 45%)',   // green
  'hsl(35, 92%, 55%)',    // amber
  'hsl(0, 72%, 55%)',     // red
  'hsl(280, 65%, 55%)',   // purple
  'hsl(190, 80%, 45%)',   // teal
  'hsl(330, 70%, 55%)',   // pink
  'hsl(60, 60%, 45%)',    // olive
];

function chartCurrencyFormatter(value: number) {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
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

function PercentTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
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
          <span className="font-medium">{formatPercent(entry.value / 100)}</span>
        </div>
      ))}
    </div>
  );
}

export function ComparisonModule() {
  const results = useScenarioComparison();
  const activeId = useStore((s) => s.activeScenarioId);

  if (results.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scenario Comparison</h2>
          <p className="text-muted-foreground mt-1">Compare your scenarios side by side</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2 py-8">
              <GitCompareArrows className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Create at least 2 scenarios to compare them.</p>
              <p className="text-xs text-muted-foreground">Use the scenario selector in the top bar to create or duplicate scenarios.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build overlay data — one entry per year, with each scenario as a separate key
  const allYears = new Set<number>();
  for (const r of results) {
    for (const s of r.simulation.annualSummaries) allYears.add(s.year);
  }
  const years = [...allYears].sort();

  // Limit to first 40 years for readability
  const displayYears = years.slice(0, 40);

  // Net worth overlay data
  const netWorthData = displayYears.map((year) => {
    const row: Record<string, unknown> = { label: `${year}` };
    for (const r of results) {
      const s = r.simulation.annualSummaries.find((a) => a.year === year);
      row[r.scenario.name] = s?.endNetWorth ?? null;
    }
    return row;
  });

  // Liquid net worth (FIRE wealth) overlay
  const liquidNWData = displayYears.map((year) => {
    const row: Record<string, unknown> = { label: `${year}` };
    for (const r of results) {
      const s = r.simulation.annualSummaries.find((a) => a.year === year);
      row[r.scenario.name] = s?.endLiquidNetWorth ?? null;
    }
    return row;
  });

  // Net income overlay
  const incomeData = displayYears.map((year) => {
    const row: Record<string, unknown> = { label: `${year}` };
    for (const r of results) {
      const s = r.simulation.annualSummaries.find((a) => a.year === year);
      row[r.scenario.name] = s?.netIncome ?? null;
    }
    return row;
  });

  // Effective tax rate overlay
  const taxRateData = displayYears.map((year) => {
    const row: Record<string, unknown> = { label: `${year}` };
    for (const r of results) {
      const s = r.simulation.annualSummaries.find((a) => a.year === year);
      row[r.scenario.name] = s ? +(s.effectiveTaxRate * 100).toFixed(1) : null;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scenario Comparison</h2>
          <p className="text-muted-foreground mt-1">
            Comparing {results.length} scenarios
          </p>
        </div>
      </div>

      <ModuleHint id="comparison">
        Create multiple scenarios using the top bar (e.g. "Buy a house" vs "Keep renting") and compare their outcomes here. The table and charts show key differences in net worth, FIRE date, tax paid, and more. Comparisons are estimate-based and we cannot guarantee correctness.
      </ModuleHint>

      {/* Key metrics comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Key Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Metric</th>
                  {results.map((r, i) => (
                    <th key={r.scenario.id} className="text-right py-2 px-3 font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                        <span className="truncate max-w-[120px]">{r.scenario.name}</span>
                        {r.scenario.id === activeId && <Badge variant="secondary" className="text-[10px] px-1 py-0">Active</Badge>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">FIRE Age</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-right py-2 px-3 font-medium">
                      {r.simulation.fireAge ? Math.floor(r.simulation.fireAge) : '—'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">FIRE Number</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-right py-2 px-3 font-medium">
                      {formatCurrency(r.simulation.fireNumber, true)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">Current Liquid NW</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-right py-2 px-3 font-medium">
                      {formatCurrency(r.simulation.currentLiquidNetWorth, true)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">Savings Rate</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-right py-2 px-3 font-medium">
                      {formatPercent(r.simulation.savingsRate)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground">NW at Retirement</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-right py-2 px-3 font-medium">
                      {formatCurrency(r.simulation.projectedNetWorthAtRetirement, true)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-muted-foreground">Readiness</td>
                  {results.map((r) => (
                    <td key={r.scenario.id} className="text-right py-2 px-3">
                      <Badge variant={
                        r.simulation.retirementReadiness === 'ahead' ? 'default' :
                        r.simulation.retirementReadiness === 'on-track' ? 'secondary' : 'destructive'
                      } className="text-[10px]">
                        {r.simulation.retirementReadiness === 'ahead' ? 'Ahead' :
                         r.simulation.retirementReadiness === 'on-track' ? 'On track' : 'Behind'}
                      </Badge>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Net Worth Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Net Worth Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netWorthData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                {results.map((r, i) => (
                  <Line
                    key={r.scenario.id}
                    type="monotone"
                    dataKey={r.scenario.name}
                    stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    strokeWidth={r.scenario.id === activeId ? 2.5 : 1.5}
                    strokeDasharray={r.scenario.id === activeId ? undefined : '6 3'}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* FIRE Wealth (Liquid Net Worth) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">FIRE Wealth (Liquid Assets)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={liquidNWData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                {results.map((r, i) => (
                  <Line
                    key={r.scenario.id}
                    type="monotone"
                    dataKey={r.scenario.name}
                    stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    strokeWidth={r.scenario.id === activeId ? 2.5 : 1.5}
                    strokeDasharray={r.scenario.id === activeId ? undefined : '6 3'}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Net Income Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Annual Net Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                {results.map((r, i) => (
                  <Bar
                    key={r.scenario.id}
                    dataKey={r.scenario.name}
                    fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    opacity={r.scenario.id === activeId ? 1 : 0.6}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Effective Tax Rate Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Effective Tax Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={taxRateData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={40} domain={[0, 'auto']} />
                <RechartsTooltip content={<PercentTooltip />} />
                <Legend />
                {results.map((r, i) => (
                  <Line
                    key={r.scenario.id}
                    type="monotone"
                    dataKey={r.scenario.name}
                    stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    strokeWidth={r.scenario.id === activeId ? 2.5 : 1.5}
                    strokeDasharray={r.scenario.id === activeId ? undefined : '6 3'}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Year-by-year difference table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Annual Net Worth by Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground min-w-[60px]">Year</th>
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground min-w-[40px]">Age</th>
                  {results.map((r, i) => (
                    <th key={r.scenario.id} className="text-right py-2 px-2 font-medium min-w-[100px]">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                        <span className="truncate max-w-[100px]">{r.scenario.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayYears.map((year) => {
                  const summaries = results.map((r) => r.simulation.annualSummaries.find((a) => a.year === year));
                  const age = summaries.find((s) => s)?.age;
                  return (
                    <tr key={year} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">{year}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">{age ?? '—'}</td>
                      {summaries.map((s, i) => (
                        <td key={results[i].scenario.id} className="text-right py-1.5 px-2 tabular-nums">
                          {s ? formatCurrency(s.endNetWorth, true) : '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
