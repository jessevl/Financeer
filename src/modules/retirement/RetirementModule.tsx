import { useStore, useActiveScenario, useSettings } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { RetirementCalcSidebar } from './RetirementCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Target, Flame, Award, Zap, Coffee, Palmtree, Crown, Calculator, Info, ArrowDownUp } from 'lucide-react';
import { useSimulation } from '@/hooks/useSimulation';
import { formatCurrency, formatPercent } from '@/lib/format';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { calculateAnnualAowIncome, calculateMiddelloonPension } from '@/engine/simulation';
import type { RetirementConfig } from '@/types';

const firePresets = [
  { label: 'Lean', icon: Coffee, amount: 24000, description: 'Basic needs, modest lifestyle' },
  { label: 'Standard', icon: Zap, amount: 36000, description: 'Comfortable NL median' },
  { label: 'Comfortable', icon: Palmtree, amount: 50000, description: 'Travel, dining, hobbies' },
  { label: 'Fat', icon: Crown, amount: 72000, description: 'Premium, no constraints' },
] as const;

export function RetirementModule() {
  const scenario = useActiveScenario();
  const settings = useSettings();
  const updateRetirement = useStore((s) => s.updateRetirement);
  const ret = scenario.retirement;
  const sim = useSimulation();
  const inflationRate = scenario.expenses.customInflationRate ?? settings.inflationRate;
  const isCoupleHousehold = scenario.tax.filingType === 'couple';
  const partnerAowMonthlyAmount = ret.partnerAowMonthlyAmount ?? ret.aowMonthlyAmount;
  const effectivePensionMonthly = (ret.pensionType === 'middelloon')
    ? calculateMiddelloonPension(ret, scenario.income.grossSalary)
    : ret.pensionMonthlyAmount;
  const partnerEffectivePensionMonthly = isCoupleHousehold
    ? ((ret.pensionType === 'middelloon')
      ? calculateMiddelloonPension(ret, scenario.income.partnerGrossSalary)
      : (ret.partnerPensionMonthlyAmount ?? 0))
    : 0;
  const totalAnnualEmployerPension = (effectivePensionMonthly + partnerEffectivePensionMonthly) * 12;
  const totalAnnualAow = calculateAnnualAowIncome(ret.aowMonthlyAmount, isCoupleHousehold, partnerAowMonthlyAmount);

  const update = (changes: Partial<RetirementConfig>) => {
    updateRetirement(scenario.id, { ...ret, ...changes });
  };

  // Compute current annual expenses from scenario data
  const computeCurrentExpenses = () => {
    const { expenses: exp } = scenario;
    const monthlyFixed = exp.monthlyFixed.reduce((s, e) => s + e.amount, 0);
    const monthlyVar = exp.monthlyVariable.reduce((s, e) => s + e.amount, 0);
    const annualSpread = exp.annualExpenses.reduce((s, e) => s + e.amount, 0) / 12;
    const healthcare = exp.healthcareMonthlyPremium + exp.healthcareDeductible / 12;
    const childCost = exp.children.reduce((s, c) => s + c.monthlyExpense, 0);
    return Math.round((monthlyFixed + monthlyVar + annualSpread + healthcare + childCost) * 12);
  };

  const fireProgress = sim.fireNumber > 0
    ? Math.min(100, ((sim.currentLiquidNetWorth) / sim.fireNumber) * 100)
    : 0;

  const readinessColor = {
    ahead: 'text-green-600 dark:text-green-400',
    'on-track': 'text-blue-600 dark:text-blue-400',
    behind: 'text-orange-600 dark:text-orange-400',
  };

  const readinessLabel = {
    ahead: 'Ahead of schedule',
    'on-track': 'On track',
    behind: 'Behind schedule',
  };

  return (
    <ModuleLayout sidebar={<RetirementCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Retirement & FIRE</h2>
        <p className="text-muted-foreground mt-1">Plan your path to financial independence.</p>
      </div>

      <ModuleHint id="retirement">
        Set your target retirement age and desired annual spending. Financeer calculates the capital you need to bridge the years before pension and AOW, plus the long-term gap that remains afterward. Employer pension, AOW, and any scheduled payout phases on lijfrente accounts are all included in that target.
      </ModuleHint>

      {/* FIRE Progress */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">FIRE Progress</h3>
            </div>
            <span className={`text-sm font-medium ${readinessColor[sim.retirementReadiness]}`}>
              <Award className="h-4 w-4 inline mr-1" />
              {readinessLabel[sim.retirementReadiness]}
            </span>
          </div>

          <Progress value={fireProgress} className="h-3 mb-3" />

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Current: {formatCurrency(sim.currentLiquidNetWorth, true)}</span>
            <span>{fireProgress.toFixed(1)}%</span>
            <span>FIRE target: {formatCurrency(sim.fireNumber, true)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Projected FIRE Age</p>
              <p className="text-2xl font-bold mt-1">
                {sim.fireAge ? Math.floor(sim.fireAge) : '—'}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Years to FIRE</p>
              <p className="text-2xl font-bold mt-1">
                {sim.yearsToFire ? sim.yearsToFire.toFixed(1) : '—'}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Coast FIRE Number</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(sim.coastFireNumber, true)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sim.coastFireAge !== null ? 'Reached!' : `${formatCurrency(Math.max(0, sim.coastFireNumber - sim.currentLiquidNetWorth), true)} gap`}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">NW at Retirement</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(sim.projectedNetWorthAtRetirement, true)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retirement Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Retirement Target
          </CardTitle>
          <CardDescription>Define when and how you want to retire</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Target Retirement Age" tooltip="The age at which you want to stop working">
              <Input type="number" value={ret.targetAge || ''} onChange={(e) => update({ targetAge: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="Desired Annual Spending" tooltip="How much you want to spend per year in retirement (in today's money)">
              <CurrencyInput value={ret.desiredAnnualSpending} onChange={(v) => update({ desiredAnnualSpending: v })} />
            </Field>
          </div>

          {/* FIRE target presets */}
          <div>
            <label className="text-sm font-medium mb-2 block">Quick-set spending target</label>
            <div className="flex flex-wrap gap-2">
              {firePresets.map(({ label, icon: Icon, amount, description }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    ret.desiredAnnualSpending === amount && 'border-primary bg-primary/5'
                  )}
                  onClick={() => update({ desiredAnnualSpending: amount })}
                  title={description}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <span className="text-muted-foreground text-xs">{formatCurrency(amount, true)}</span>
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => update({ desiredAnnualSpending: computeCurrentExpenses() })}
                title="Set to your current annual expenses from the Expenses module"
              >
                <Calculator className="h-3.5 w-3.5" />
                Current expenses
                <span className="text-muted-foreground text-xs">{formatCurrency(computeCurrentExpenses(), true)}</span>
              </Button>
            </div>
          </div>

          <Field label="Safe Withdrawal Rate (SWR)" tooltip="Percentage of portfolio to withdraw annually. The 4% rule is a common starting point." className="max-w-xs">
            <PercentInput value={ret.safeWithdrawalRate} onChange={(v) => update({ safeWithdrawalRate: v })} />
          </Field>

          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1.5">
            <p>
              Your spending target of {formatCurrency(ret.desiredAnnualSpending)} is in <strong>today&apos;s money</strong>.
              Financeer now includes bridge years before AOW and pension start, so your <strong>portfolio target today is {formatCurrency(sim.fireNumber)}</strong>.
            </p>
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              The simulation inflates this target at {formatPercent(inflationRate)}/year (configured in Settings). Pension and AOW income reduce the long-term gap automatically once those start ages are reached.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pension */}
      <Card>
        <CardHeader>
          <CardTitle>Pension Income</CardTitle>
          <CardDescription>State pension (AOW) and employer pension for you and your partner</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="AOW Start Age" tooltip="The age when state pension (AOW) starts. Currently 67 in the Netherlands.">
              <Input type="number" value={ret.aowStartAge || ''} onChange={(e) => update({ aowStartAge: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="Employer Pension Start Age" tooltip="The age when your employer/corporate pension starts paying out.">
              <Input type="number" value={ret.pensionStartAge || ''} onChange={(e) => update({ pensionStartAge: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label={isCoupleHousehold ? 'Your AOW Monthly Amount' : 'AOW Monthly Amount'} tooltip="Gross monthly AOW for you. In couples, enter each adult separately.">
              <CurrencyInput value={ret.aowMonthlyAmount} onChange={(v) => update({ aowMonthlyAmount: v })} />
            </Field>
            {isCoupleHousehold && (
              <Field label="Partner AOW Monthly Amount" tooltip="Gross monthly AOW for your partner.">
                <CurrencyInput value={partnerAowMonthlyAmount} onChange={(v) => update({ partnerAowMonthlyAmount: v })} />
              </Field>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Enter monthly AOW per adult. Financeer totals your AOW and partner AOW separately, so you can model different entitlements within the household.
          </p>

          <Field label="Pension Estimation" tooltip="Fixed: enter a known monthly amount. Middelloon: estimate from career-average salary scheme.">
            <Select value={ret.pensionType ?? 'fixed'} onValueChange={(v) => update({ pensionType: v as 'fixed' | 'middelloon' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed monthly amount</SelectItem>
                <SelectItem value="middelloon">Middelloon (career-average)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {(ret.pensionType ?? 'fixed') === 'fixed' ? (
            <div className={`grid gap-4 ${isCoupleHousehold ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
              <Field label={isCoupleHousehold ? 'Your Employer Pension (monthly)' : 'Employer Pension (monthly)'} tooltip="Expected monthly pension income from your employer pension fund.">
                <CurrencyInput value={ret.pensionMonthlyAmount} onChange={(v) => update({ pensionMonthlyAmount: v })} />
              </Field>
              {isCoupleHousehold && (
                <Field label="Partner Employer Pension (monthly)" tooltip="Expected monthly pension income from your partner's employer pension fund.">
                  <CurrencyInput value={ret.partnerPensionMonthlyAmount ?? 0} onChange={(v) => update({ partnerPensionMonthlyAmount: v })} />
                </Field>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Accrual Rate" tooltip="Annual pension accrual rate. Most Dutch schemes use 1.875%.">
                  <PercentInput value={ret.pensionAccrualRate ?? 0.01875} onChange={(v) => update({ pensionAccrualRate: v })} />
                </Field>
                <Field label="Franchise" tooltip="Annual salary threshold below which no pension accrues (drempelbedrag). ~€17,545 in 2025.">
                  <CurrencyInput value={ret.pensionFranchise ?? 17545} onChange={(v) => update({ pensionFranchise: v })} />
                </Field>
                <Field label="Service Start Age" tooltip="Age when you started accruing pension (beginning of career).">
                  <Input type="number" value={ret.pensionServiceStartAge ?? 25} onChange={(e) => update({ pensionServiceStartAge: parseInt(e.target.value) || 0 })} />
                </Field>
                <Field label="Part-time Factor" tooltip="1.0 = full-time. 0.8 = 4 days/week. Reduces pension accrual proportionally.">
                  <Input type="number" step="0.05" min="0" max="1" value={ret.pensionPartTimeFactor ?? 1.0} onChange={(e) => update({ pensionPartTimeFactor: parseFloat(e.target.value) || 1.0 })} />
                </Field>
                <Field label="Early Retirement Penalty" tooltip="Actuarial reduction per year that pension starts before AOW age. Typically 6-7% per year.">
                  <PercentInput value={ret.pensionEarlyRetirementPenalty ?? 0.065} onChange={(v) => update({ pensionEarlyRetirementPenalty: v })} />
                </Field>
              </div>
              {(() => {
                return (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm space-y-1.5">
                    <p className="font-medium">
                      Estimated employer pension: {formatCurrency(totalAnnualEmployerPension)}/year household total
                    </p>
                    <p className="text-muted-foreground">
                      You: {formatCurrency(effectivePensionMonthly)}/month · {formatCurrency(effectivePensionMonthly * 12)}/year
                      {isCoupleHousehold && (
                        <>
                          {' '}| Partner: {formatCurrency(partnerEffectivePensionMonthly)}/month · {formatCurrency(partnerEffectivePensionMonthly * 12)}/year
                        </>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      Based on {Math.max(0, ret.targetAge - (ret.pensionServiceStartAge ?? 25))} years of service,
                      {' '}{formatCurrency(scenario.income.grossSalary)} gross salary,
                      {isCoupleHousehold && (
                        <>
                          {' '}and {formatCurrency(scenario.income.partnerGrossSalary)} partner gross salary,
                        </>
                      )}
                      {' '}{formatCurrency(ret.pensionFranchise ?? 17545)} franchise,
                      {' '}{formatPercent(ret.pensionAccrualRate ?? 0.01875)} accrual rate,
                      {' '}{(ret.pensionPartTimeFactor ?? 1.0).toFixed(2)} part-time factor.
                    </p>
                    {(ret.pensionStartAge < ret.aowStartAge) && (
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠ Pension starts {ret.aowStartAge - ret.pensionStartAge} year(s) before AOW age → {formatPercent((ret.pensionEarlyRetirementPenalty ?? 0.065) * (ret.aowStartAge - ret.pensionStartAge))} early retirement reduction applied.
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {(ret.aowMonthlyAmount > 0 || partnerAowMonthlyAmount > 0 || ret.pensionMonthlyAmount > 0 || (ret.partnerPensionMonthlyAmount ?? 0) > 0 || (ret.pensionType === 'middelloon')) && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p>
                From age {ret.pensionStartAge ?? ret.targetAge}, you'll receive approximately{' '}
                <span className="font-semibold">{formatCurrency(totalAnnualEmployerPension)}</span>
                /year in employer pension income for the household. From age {ret.aowStartAge}, AOW adds approximately{' '}
                <span className="font-semibold">{formatCurrency(totalAnnualAow)}</span>
                /year for the household.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5" />
            Withdrawal Strategy
          </CardTitle>
          <CardDescription>How to draw down investments during retirement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Withdrawal Order" tooltip="Tax-efficient: withdraw from taxable accounts first, deferring pension/lijfrente. Proportional: withdraw equally from all accounts.">
            <Select value={ret.withdrawalStrategy ?? 'tax-efficient'} onValueChange={(v) => update({ withdrawalStrategy: v as RetirementConfig['withdrawalStrategy'] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tax-efficient">Tax-efficient (recommended)</SelectItem>
                <SelectItem value="proportional">Proportional</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1.5">
            {(ret.withdrawalStrategy ?? 'tax-efficient') === 'tax-efficient' ? (
              <>
                <p className="font-medium">Tax-efficient order:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                  <li>Cash (above emergency fund)</li>
                  <li>Savings accounts</li>
                  <li>Brokerage and real-estate accounts</li>
                </ol>
                <p className="text-muted-foreground">
                  Lijfrente pots are still excluded from free-form withdrawals here. Their configured payout schedules in Investments are handled separately as taxable retirement income.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Withdraws proportionally from liquid accounts only (savings, brokerage, and real-estate).
                Lijfrente balances are kept outside the generic drawdown order.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </ModuleLayout>
  );
}
