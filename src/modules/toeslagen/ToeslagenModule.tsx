import { useStore, useActiveScenario, useSettings } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { ToeslagenCalcSidebar } from './ToeslagenCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { Separator } from '@/components/ui/separator';
import { Heart, Baby, Coins, RefreshCw, School, Home } from 'lucide-react';
import { useSimulation } from '@/hooks/useSimulation';
import { formatCurrency } from '@/lib/format';
import { getToeslagenPreset } from '@/data/toeslagenPresets';
import type { ToeslagenConfig } from '@/types';
import { calculateAnnualToeslagen } from '@/engine/toeslagen';

export function ToeslagenModule() {
  const scenario = useActiveScenario();
  const updateToeslagen = useStore((s) => s.updateToeslagen);
  const settings = useSettings();
  const toeslagen = scenario.toeslagen;
  const sim = useSimulation();

  const update = (changes: Partial<ToeslagenConfig>) => {
    updateToeslagen(scenario.id, { ...toeslagen, ...changes });
  };

  const loadPreset = () => {
    const preset = getToeslagenPreset(settings.taxLawYear);
    update({ presetYear: settings.taxLawYear, ...preset });
  };

  // Compute current year toeslagen estimate
  const currentYear = new Date().getFullYear();
  const currentYearSummary = sim.annualSummaries.find((s) => s.year === currentYear);

  // Calculate individual toeslag breakdown for display
  const grossIncome = currentYearSummary?.grossIncome ?? 0;
  const allChildren = [...scenario.expenses.children];
  const breakdown = calculateAnnualToeslagen(
    grossIncome,
    (currentYearSummary?.endCashBalance ?? 0) + (currentYearSummary?.endInvestmentValue ?? 0),
    allChildren,
    new Date(),
    scenario.tax.filingType === 'couple',
    !scenario.income.hasPartner,
    toeslagen,
  );

  return (
    <ModuleLayout sidebar={<ToeslagenCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Toeslagen & Benefits</h2>
        <p className="text-muted-foreground mt-1">Dutch government subsidies and universal benefits.</p>
      </div>

      <ModuleHint id="toeslagen">
        Toeslagen are income-dependent government allowances. Enable the ones that apply to you — the app calculates eligibility and amounts based on your income and household. Thresholds are loaded from the selected tax law year. Common ones: zorgtoeslag (healthcare), huurtoeslag (rent), kinderopvangtoeslag (childcare).
      </ModuleHint>

      {/* Summary Card */}
      {toeslagen.enabled && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{currentYear} Benefits Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" /> Zorgtoeslag
                  </span>
                  <span className="font-medium text-green-600">+{formatCurrency(breakdown.zorgtoeslag)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Baby className="h-3.5 w-3.5" /> Kindgebonden budget
                  </span>
                  <span className="font-medium text-green-600">+{formatCurrency(breakdown.kindgebondenBudget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5" /> Kinderbijslag
                  </span>
                  <span className="font-medium text-green-600">+{formatCurrency(breakdown.kinderbijslag)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <School className="h-3.5 w-3.5" /> Kinderopvangtoeslag
                  </span>
                  <span className="font-medium text-green-600">+{formatCurrency(breakdown.kinderopvangtoeslag)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5" /> Huurtoeslag
                  </span>
                  <span className="font-medium text-green-600">+{formatCurrency(breakdown.huurtoeslag)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Total</span>
                  <span className="font-semibold text-green-600">+{formatCurrency(breakdown.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly</span>
                  <span className="font-medium">+{formatCurrency(breakdown.total / 12)}/mo</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enable & Preset */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Toeslagen Settings — {settings.taxLawYear}</CardTitle>
            <Button variant="outline" size="sm" onClick={loadPreset}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset to preset
            </Button>
          </div>
          <CardDescription>Using <strong>{settings.taxLawYear}</strong> parameters (configured in Settings). Enable toeslagen to include government benefits in your simulation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={toeslagen.enabled} onCheckedChange={(v) => update({ enabled: v })} />
            <Label>Include toeslagen in simulation</Label>
          </div>
        </CardContent>
      </Card>

      {toeslagen.enabled && (
        <>
          {/* Zorgtoeslag */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" /> Zorgtoeslag
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={toeslagen.zorgtoeslag.enabled}
                    onCheckedChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, enabled: v } })}
                  />
                  <Label className="text-sm">Enabled</Label>
                </div>
              </div>
              <CardDescription>Healthcare allowance — income-dependent subsidy for health insurance</CardDescription>
            </CardHeader>
            {toeslagen.zorgtoeslag.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Standard premium (standaardpremie)">
                    <CurrencyInput value={toeslagen.zorgtoeslag.standaardpremie} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, standaardpremie: v } })} />
                  </Field>
                  <Field label="Income threshold (drempelinkomen)">
                    <CurrencyInput value={toeslagen.zorgtoeslag.drempelinkomen} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, drempelinkomen: v } })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Single threshold %">
                    <PercentInput value={toeslagen.zorgtoeslag.drempelPercentageSingle} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, drempelPercentageSingle: v } })} />
                  </Field>
                  <Field label="Couple threshold %">
                    <PercentInput value={toeslagen.zorgtoeslag.drempelPercentageCouple} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, drempelPercentageCouple: v } })} />
                  </Field>
                  <Field label="Excess %">
                    <PercentInput value={toeslagen.zorgtoeslag.excessPercentage} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, excessPercentage: v } })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Wealth limit (single)" tooltip="Vermogensgrens alleenstaand">
                    <CurrencyInput value={toeslagen.zorgtoeslag.vermogensGrensSingle} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, vermogensGrensSingle: v } })} />
                  </Field>
                  <Field label="Wealth limit (couple)" tooltip="Vermogensgrens toeslagpartner">
                    <CurrencyInput value={toeslagen.zorgtoeslag.vermogensGrensCouple} onChange={(v) => update({ zorgtoeslag: { ...toeslagen.zorgtoeslag, vermogensGrensCouple: v } })} />
                  </Field>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Kindgebonden Budget */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Baby className="h-5 w-5" /> Kindgebonden Budget
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={toeslagen.kindgebondenBudget.enabled}
                    onCheckedChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, enabled: v } })}
                  />
                  <Label className="text-sm">Enabled</Label>
                </div>
              </div>
              <CardDescription>Income-dependent child budget per child, with age supplements</CardDescription>
            </CardHeader>
            {toeslagen.kindgebondenBudget.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Base per child">
                    <CurrencyInput value={toeslagen.kindgebondenBudget.basePerChild} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, basePerChild: v } })} />
                  </Field>
                  <Field label="Single parent extra">
                    <CurrencyInput value={toeslagen.kindgebondenBudget.singleParentExtra} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, singleParentExtra: v } })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Supplement 12–15" tooltip="Extra per child aged 12-15">
                    <CurrencyInput value={toeslagen.kindgebondenBudget.supplement12to15} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, supplement12to15: v } })} />
                  </Field>
                  <Field label="Supplement 16–17" tooltip="Extra per child aged 16-17">
                    <CurrencyInput value={toeslagen.kindgebondenBudget.supplement16to17} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, supplement16to17: v } })} />
                  </Field>
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Income threshold">
                    <CurrencyInput value={toeslagen.kindgebondenBudget.drempelinkomen} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, drempelinkomen: v } })} />
                  </Field>
                  <Field label="Couple extra threshold">
                    <CurrencyInput value={toeslagen.kindgebondenBudget.coupleExtraThreshold} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, coupleExtraThreshold: v } })} />
                  </Field>
                  <Field label="Reduction rate">
                    <PercentInput value={toeslagen.kindgebondenBudget.reductionRate} onChange={(v) => update({ kindgebondenBudget: { ...toeslagen.kindgebondenBudget, reductionRate: v } })} />
                  </Field>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Kinderbijslag */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" /> Kinderbijslag
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={toeslagen.kinderbijslag.enabled}
                    onCheckedChange={(v) => update({ kinderbijslag: { ...toeslagen.kinderbijslag, enabled: v } })}
                  />
                  <Label className="text-sm">Enabled</Label>
                </div>
              </div>
              <CardDescription>Universal child benefit — not income-dependent, quarterly per child</CardDescription>
            </CardHeader>
            {toeslagen.kinderbijslag.enabled && (
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Quarterly 0–5">
                    <CurrencyInput value={toeslagen.kinderbijslag.quarterly0to5} onChange={(v) => update({ kinderbijslag: { ...toeslagen.kinderbijslag, quarterly0to5: v } })} />
                  </Field>
                  <Field label="Quarterly 6–11">
                    <CurrencyInput value={toeslagen.kinderbijslag.quarterly6to11} onChange={(v) => update({ kinderbijslag: { ...toeslagen.kinderbijslag, quarterly6to11: v } })} />
                  </Field>
                  <Field label="Quarterly 12–17">
                    <CurrencyInput value={toeslagen.kinderbijslag.quarterly12to17} onChange={(v) => update({ kinderbijslag: { ...toeslagen.kinderbijslag, quarterly12to17: v } })} />
                  </Field>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Kinderopvangtoeslag */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <School className="h-5 w-5" /> Kinderopvangtoeslag
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={toeslagen.kinderopvangtoeslag.enabled}
                    onCheckedChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, enabled: v } })}
                  />
                  <Label className="text-sm">Enabled</Label>
                </div>
              </div>
              <CardDescription>Childcare benefit — income-dependent subsidy for daycare, BSO, or gastouder. Configure childcare hours per child in the Expenses module.</CardDescription>
            </CardHeader>
            {toeslagen.kinderopvangtoeslag.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Max rate daycare" tooltip="Maximum hourly rate for kinderdagverblijf">
                    <CurrencyInput value={toeslagen.kinderopvangtoeslag.maxHourlyRateDaycare} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, maxHourlyRateDaycare: v } })} />
                  </Field>
                  <Field label="Max rate BSO" tooltip="Maximum hourly rate for buitenschoolse opvang">
                    <CurrencyInput value={toeslagen.kinderopvangtoeslag.maxHourlyRateBso} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, maxHourlyRateBso: v } })} />
                  </Field>
                  <Field label="Max rate gastouder">
                    <CurrencyInput value={toeslagen.kinderopvangtoeslag.maxHourlyRateGastouder} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, maxHourlyRateGastouder: v } })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Max hours/month">
                    <CurrencyInput value={toeslagen.kinderopvangtoeslag.maxHoursPerMonth} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, maxHoursPerMonth: v } })} />
                  </Field>
                  <Field label="Max % reimbursement">
                    <PercentInput value={toeslagen.kinderopvangtoeslag.maxPercentage} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, maxPercentage: v } })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Low-income threshold" tooltip="Below this income → maximum reimbursement">
                    <CurrencyInput value={toeslagen.kinderopvangtoeslag.incomeThresholdLow} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, incomeThresholdLow: v } })} />
                  </Field>
                  <Field label="High-income threshold" tooltip="Above this income → minimum reimbursement">
                    <CurrencyInput value={toeslagen.kinderopvangtoeslag.incomeThresholdHigh} onChange={(v) => update({ kinderopvangtoeslag: { ...toeslagen.kinderopvangtoeslag, incomeThresholdHigh: v } })} />
                  </Field>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Huurtoeslag */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" /> Huurtoeslag
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={toeslagen.huurtoeslag.enabled}
                    onCheckedChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, enabled: v } })}
                  />
                  <Label className="text-sm">Enabled</Label>
                </div>
              </div>
              <CardDescription>Rent allowance — income-dependent subsidy for social housing tenants</CardDescription>
            </CardHeader>
            {toeslagen.huurtoeslag.enabled && (
              <CardContent className="space-y-4">
                <Field label="Your monthly rent (kale huur)" tooltip="The base monthly rent excluding service costs">
                  <CurrencyInput value={toeslagen.huurtoeslag.monthlyRent} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, monthlyRent: v } })} />
                </Field>
                <Separator />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Basishuur" tooltip="Minimum rent threshold — no subsidy below this">
                    <CurrencyInput value={toeslagen.huurtoeslag.basishuur} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, basishuur: v } })} />
                  </Field>
                  <Field label="Aftoppingsgrens" tooltip="Rent ceiling for full subsidy">
                    <CurrencyInput value={toeslagen.huurtoeslag.aftoppingsgrens} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, aftoppingsgrens: v } })} />
                  </Field>
                  <Field label="Max huur" tooltip="Absolute maximum eligible rent">
                    <CurrencyInput value={toeslagen.huurtoeslag.maxHuur} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, maxHuur: v } })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Max income (single)">
                    <CurrencyInput value={toeslagen.huurtoeslag.maxInkomenSingle} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, maxInkomenSingle: v } })} />
                  </Field>
                  <Field label="Max income (couple)">
                    <CurrencyInput value={toeslagen.huurtoeslag.maxInkomenCouple} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, maxInkomenCouple: v } })} />
                  </Field>
                  <Field label="Wealth limit" tooltip="Vermogensgrens">
                    <CurrencyInput value={toeslagen.huurtoeslag.vermogensGrens} onChange={(v) => update({ huurtoeslag: { ...toeslagen.huurtoeslag, vermogensGrens: v } })} />
                  </Field>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Info note */}
          <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p>
              <strong>Note:</strong> Toeslagen are calculated automatically based on your income, children
              (configured in Expenses), and partner status. Add children in the Expenses module to see
              kindgebonden budget and kinderbijslag calculations.
            </p>
          </div>
        </>
      )}
    </ModuleLayout>
  );
}
