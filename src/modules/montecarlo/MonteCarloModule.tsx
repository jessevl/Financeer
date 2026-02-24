import { useMemo, useState } from 'react';
import { useActiveScenario, useSettings } from '@/store';
import { runMonteCarlo, type MonteCarloResult } from '@/engine/monteCarlo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { ModuleHint } from '@/components/common/ModuleHint';
import {
  Dice5,
  Flame,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

function chartCurrencyFormatter(value: number) {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

const ITERATIONS_OPTIONS = [100, 250, 500, 1000] as const;

export function MonteCarloModule() {
  const scenario = useActiveScenario();
  const settings = useSettings();
  const [iterations, setIterations] = useState<number>(250);

  const mc = useMemo<MonteCarloResult>(() => {
    return runMonteCarlo(scenario, settings, iterations);
  }, [scenario, settings, iterations]);

  // Build chart data
  const chartData = mc.years.map((year, i) => ({
    year,
    label: `${year}`,
    p10: mc.p10[i],
    p25: mc.p25[i],
    p50: mc.p50[i],
    p75: mc.p75[i],
    p90: mc.p90[i],
    baseline: mc.baseline[i],
    // For stacked area bands
    band_10_25: mc.p25[i] - mc.p10[i],
    band_25_50: mc.p50[i] - mc.p25[i],
    band_50_75: mc.p75[i] - mc.p50[i],
    band_75_90: mc.p90[i] - mc.p75[i],
  }));

  const successPct = (mc.fireSuccessRate * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Monte Carlo Analysis</h2>
          <p className="text-muted-foreground mt-1">
            Probabilistic outcomes across {mc.iterations} simulated paths
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Iterations:</span>
          <div className="flex gap-1">
            {ITERATIONS_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setIterations(n)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  iterations === n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ModuleHint id="montecarlo">
        Monte Carlo runs thousands of simulations with randomized market returns based on your investment allocations and volatility settings. The percentile bands show how likely different outcomes are. A higher success rate means your plan is more resilient to market downturns. This is a probabilistic model and we cannot guarantee correctness or real-world outcomes.
      </ModuleHint>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">FIRE Success</p>
                <p className="text-2xl font-bold tracking-tight">{successPct}%</p>
                <p className="text-xs text-muted-foreground">by age {scenario.retirement.targetAge}</p>
              </div>
              <div className={`p-2 rounded-lg ${
                mc.fireSuccessRate > 0.8 ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400' :
                mc.fireSuccessRate > 0.5 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
              }`}>
                <Flame className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Median FIRE Age</p>
              <p className="text-2xl font-bold tracking-tight">
                {mc.fireAgeP50 != null ? Math.floor(mc.fireAgeP50) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {mc.fireAgeP10 != null && mc.fireAgeP90 != null
                  ? `Range: ${Math.floor(mc.fireAgeP10)}–${Math.ceil(mc.fireAgeP90)}`
                  : 'Not enough data'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Median NW at Retire</p>
              <p className="text-2xl font-bold tracking-tight">
                {(() => {
                  // Find closest year to retirement
                  const currentAge = new Date().getFullYear() - new Date(settings.dateOfBirth).getFullYear();
                  const yearsToRetire = scenario.retirement.targetAge - currentAge;
                  const idx = Math.min(yearsToRetire, mc.p50.length - 1);
                  return idx >= 0 ? formatCurrency(mc.p50[idx], true) : '—';
                })()}
              </p>
              <p className="text-xs text-muted-foreground">P50 liquid net worth</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Worst Case (P10)</p>
              <p className="text-2xl font-bold tracking-tight">
                {mc.p10.length > 0 ? formatCurrency(mc.p10[mc.p10.length - 1], true) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">End of projection</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fan chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            FIRE Wealth Probability Fan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="mcOuter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="mcInner" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={chartCurrencyFormatter} tick={{ fontSize: 10 }} width={65} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
                        <p className="font-medium mb-1.5">{label}</p>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">P90 (optimistic)</span>
                            <span className="font-medium">{formatCurrency(d.p90)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">P75</span>
                            <span className="font-medium">{formatCurrency(d.p75)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">P50 (median)</span>
                            <span className="font-medium font-semibold">{formatCurrency(d.p50)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">P25</span>
                            <span className="font-medium">{formatCurrency(d.p25)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">P10 (pessimistic)</span>
                            <span className="font-medium">{formatCurrency(d.p10)}</span>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-border pt-1 mt-1">
                            <span className="text-muted-foreground">Baseline</span>
                            <span className="font-medium">{formatCurrency(d.baseline)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* P10-P25 band (outer) */}
                <Area type="monotone" dataKey="p10" stackId="fan" stroke="none" fill="transparent" />
                <Area type="monotone" dataKey="band_10_25" stackId="fan" stroke="none" fill="url(#mcOuter)" />
                {/* P25-P50 band (inner) */}
                <Area type="monotone" dataKey="band_25_50" stackId="fan" stroke="none" fill="url(#mcInner)" />
                {/* P50-P75 band (inner) */}
                <Area type="monotone" dataKey="band_50_75" stackId="fan" stroke="none" fill="url(#mcInner)" />
                {/* P75-P90 band (outer) */}
                <Area type="monotone" dataKey="band_75_90" stackId="fan" stroke="none" fill="url(#mcOuter)" />
                {/* Median line */}
                <Line type="monotone" dataKey="p50" name="Median (P50)" stroke="hsl(221, 83%, 53%)" strokeWidth={2.5} dot={false} />
                {/* Baseline (deterministic) */}
                <Line type="monotone" dataKey="baseline" name="Deterministic" stroke="hsl(25, 95%, 53%)" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-8 h-3 rounded-sm opacity-60" style={{ background: 'linear-gradient(to bottom, hsla(221, 83%, 53%, 0.18), hsla(221, 83%, 53%, 0.06))' }} />
              P25–P75
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-8 h-3 rounded-sm opacity-40" style={{ background: 'linear-gradient(to bottom, hsla(221, 83%, 53%, 0.08), hsla(221, 83%, 53%, 0.02))' }} />
              P10–P90
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-8 h-0.5 bg-[hsl(221,83%,53%)]" />
              Median
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-8 h-0.5 border-t-2 border-dashed border-[hsl(25,95%,53%)]" />
              Deterministic
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Percentile table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Dice5 className="h-4 w-4" />
            Percentile Breakdown by Year
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Year</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">P10</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">P25</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground font-bold">P50</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">P75</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">P90</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Baseline</th>
                </tr>
              </thead>
              <tbody>
                {mc.years
                  .map((year, i) => ({ year, i }))
                  .filter((_, idx) => idx % 5 === 0 || idx === mc.years.length - 1)
                  .map(({ year, i }) => (
                    <tr key={year} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 px-2 font-medium">{year}</td>
                      <td className="py-1.5 px-2 text-right text-red-600 dark:text-red-400">{formatCurrency(mc.p10[i], true)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(mc.p25[i], true)}</td>
                      <td className="py-1.5 px-2 text-right font-bold">{formatCurrency(mc.p50[i], true)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(mc.p75[i], true)}</td>
                      <td className="py-1.5 px-2 text-right text-green-600 dark:text-green-400">{formatCurrency(mc.p90[i], true)}</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">{formatCurrency(mc.baseline[i], true)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Methodology note */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Methodology:</strong> Each iteration samples random annual investment returns from a normal distribution
            centered on the expected return with standard deviation equal to the configured volatility (σ) per account. Returns are geometric-mean averaged across the projection horizon.
            The fan chart shows the P10–P90 range of liquid net worth outcomes. FIRE success rate measures the fraction of iterations where
            FIRE wealth exceeded the FIRE number by the target retirement age. This model does not account for sequence-of-returns risk within years
            or correlation across asset classes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
