import { useStore, useActiveScenario, useSettings } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { TaxCalcSidebar } from './TaxCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, CurrencyInput, PercentInput, PresetField } from '@/components/common/FormFields';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { FileText, RefreshCw, Leaf, Gift, PiggyBank, Home, Plus, Trash2, Briefcase } from 'lucide-react';
import { useSimulation } from '@/hooks/useSimulation';
import { formatCurrency, formatPercent } from '@/lib/format';
import { getTaxPreset } from '@/data/taxPresets';
import { calculateJaarruimte } from '@/engine/tax';
import type { TaxConfig, TaxOptimizationsConfig, SelfEmploymentConfig } from '@/types';

export function TaxModule() {
  const scenario = useActiveScenario();
  const updateTax = useStore((s) => s.updateTax);
  const settings = useSettings();
  const tax = scenario.tax;
  const income = scenario.income;
  const sim = useSimulation();

  const update = (changes: Partial<TaxConfig>) => {
    updateTax(scenario.id, { ...tax, ...changes });
  };

  const updateOpt = (changes: Partial<TaxOptimizationsConfig>) => {
    update({ taxOptimizations: { ...tax.taxOptimizations, ...changes } });
  };

  const updateSE = (changes: Partial<SelfEmploymentConfig>) => {
    update({ selfEmployment: { ...tax.selfEmployment, ...changes } });
  };

  const se = tax.selfEmployment;
  const opt = tax.taxOptimizations;

  const loadPreset = () => {
    const preset = getTaxPreset(settings.taxLawYear);
    update({ presetYear: settings.taxLawYear, ...preset });
  };

  // Reference preset for comparison
  const preset = getTaxPreset(settings.taxLawYear);

  // Current year tax summary from simulation
  const currentYear = new Date().getFullYear();
  const currentYearSummary = sim.annualSummaries.find((s) => s.year === currentYear);
  const isFilingTypeForcedByPartner = income.hasPartner;
  const effectiveFilingType = isFilingTypeForcedByPartner ? 'couple' : tax.filingType;

  return (
    <ModuleLayout sidebar={<TaxCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tax Configuration</h2>
        <p className="text-muted-foreground mt-1">Dutch tax settings &amp; current year overview.</p>
      </div>

      <ModuleHint id="tax">
        Tax brackets and credits are loaded from presets based on your selected tax law year (set in Personal). You can override individual values here. Advanced options include Box 2 (investments in a BV), Box 3 (savings/investments), self-employment deductions, and tax optimizations like lijfrente and giftenaftrek. These outputs are estimates and we cannot guarantee correctness for your exact filing situation.
      </ModuleHint>

      {/* Tax Summary */}
      {currentYearSummary && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{currentYear} Tax Estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Income</span>
                  <span className="font-medium">{formatCurrency(currentYearSummary.grossIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income Tax (Box 1)</span>
                  <span className="font-medium text-destructive">-{formatCurrency(currentYearSummary.taxBox1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Credits</span>
                  <span className="font-medium text-green-600">+{formatCurrency(currentYearSummary.taxCredits)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wealth Tax (Box 3)</span>
                  <span className="font-medium text-destructive">-{formatCurrency(currentYearSummary.taxBox3)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Income</span>
                  <span className="font-semibold">{formatCurrency(currentYearSummary.netIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective Tax Rate</span>
                  <span className="font-medium">{formatPercent(currentYearSummary.effectiveTaxRate)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preset */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tax Year Preset — {settings.taxLawYear}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadPreset}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset to preset
            </Button>
          </div>
          <CardDescription>
            Using <strong>{settings.taxLawYear}</strong> tax law year (configured in Settings).
            Reset loads the official rates; customise individual values below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Filing Type" className="max-w-xs">
            <Select
              value={effectiveFilingType}
              onValueChange={(v) => update({ filingType: v as 'single' | 'couple' })}
              disabled={isFilingTypeForcedByPartner}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="couple">Fiscal partners (couple)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isFilingTypeForcedByPartner && (
            <p className="text-xs text-muted-foreground mt-2">
              Filing type is locked to fiscal partners while partner income is enabled in Income.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Box 1 Brackets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Box 1 — Income Tax Brackets</CardTitle>
              <CardDescription>Progressive income tax rates including social contributions</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  // Insert a new bracket before the top bracket
                  const brackets = [...tax.box1Brackets];
                  const lastIdx = brackets.length - 1;
                  const prevUpper = brackets[lastIdx - 1]?.upperLimit ?? 50000;
                  brackets.splice(lastIdx, 0, { upperLimit: prevUpper + 20000, rate: brackets[lastIdx].rate });
                  update({ box1Brackets: brackets });
                }}
                title="Add bracket"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={tax.box1Brackets.length <= 2}
                onClick={() => {
                  // Remove the second-to-last bracket (keep first + top)
                  const brackets = [...tax.box1Brackets];
                  if (brackets.length > 2) brackets.splice(brackets.length - 2, 1);
                  update({ box1Brackets: brackets });
                }}
                title="Remove bracket"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {tax.box1Brackets.map((bracket, idx) => {
            const presetBracket = preset.box1Brackets[idx];
            return (
              <div key={idx} className="flex items-end gap-3">
                <PresetField
                  label={idx === 0 ? 'Upper Limit' : ''}
                  className="w-40"
                  presetValue={presetBracket?.upperLimit ?? undefined}
                  currentValue={bracket.upperLimit ?? undefined}
                  format="currency"
                  onRestore={() => {
                    if (!presetBracket) return;
                    const brackets = [...tax.box1Brackets];
                    brackets[idx] = { ...bracket, upperLimit: presetBracket.upperLimit };
                    update({ box1Brackets: brackets });
                  }}
                >
                  {bracket.upperLimit !== null ? (
                    <CurrencyInput
                      value={bracket.upperLimit}
                      onChange={(v) => {
                        const brackets = [...tax.box1Brackets];
                        brackets[idx] = { ...bracket, upperLimit: v };
                        update({ box1Brackets: brackets });
                      }}
                    />
                  ) : (
                    <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">No limit</div>
                  )}
                </PresetField>
                <PresetField
                  label={idx === 0 ? 'Rate' : ''}
                  className="w-32"
                  presetValue={presetBracket?.rate}
                  currentValue={bracket.rate}
                  format="percent"
                  onRestore={() => {
                    if (!presetBracket) return;
                    const brackets = [...tax.box1Brackets];
                    brackets[idx] = { ...bracket, rate: presetBracket.rate };
                    update({ box1Brackets: brackets });
                  }}
                >
                  <PercentInput
                    value={bracket.rate}
                    onChange={(v) => {
                      const brackets = [...tax.box1Brackets];
                      brackets[idx] = { ...bracket, rate: v };
                      update({ box1Brackets: brackets });
                    }}
                  />
                </PresetField>
                <span className="text-sm text-muted-foreground pb-2">
                  {idx === 0 ? '1st bracket' : idx === tax.box1Brackets.length - 1 ? 'Top bracket' : `${idx + 1}th bracket`}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Tax Credits */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Credits</CardTitle>
          <CardDescription>Algemene heffingskorting &amp; Arbeidskorting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">General Tax Credit (Algemene heffingskorting)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <PresetField label="Maximum" presetValue={preset.generalTaxCredit.maxAmount} currentValue={tax.generalTaxCredit.maxAmount} format="currency" onRestore={() => update({ generalTaxCredit: { ...tax.generalTaxCredit, maxAmount: preset.generalTaxCredit.maxAmount } })}>
                <CurrencyInput value={tax.generalTaxCredit.maxAmount} onChange={(v) => update({ generalTaxCredit: { ...tax.generalTaxCredit, maxAmount: v } })} />
              </PresetField>
              <PresetField label="Phase-out start" presetValue={preset.generalTaxCredit.phaseOutStart} currentValue={tax.generalTaxCredit.phaseOutStart} format="currency" onRestore={() => update({ generalTaxCredit: { ...tax.generalTaxCredit, phaseOutStart: preset.generalTaxCredit.phaseOutStart } })}>
                <CurrencyInput value={tax.generalTaxCredit.phaseOutStart} onChange={(v) => update({ generalTaxCredit: { ...tax.generalTaxCredit, phaseOutStart: v } })} />
              </PresetField>
              <PresetField label="Phase-out end" presetValue={preset.generalTaxCredit.phaseOutEnd} currentValue={tax.generalTaxCredit.phaseOutEnd} format="currency" onRestore={() => update({ generalTaxCredit: { ...tax.generalTaxCredit, phaseOutEnd: preset.generalTaxCredit.phaseOutEnd } })}>
                <CurrencyInput value={tax.generalTaxCredit.phaseOutEnd} onChange={(v) => update({ generalTaxCredit: { ...tax.generalTaxCredit, phaseOutEnd: v } })} />
              </PresetField>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-3">Labour Tax Credit (Arbeidskorting)</h4>
            <div className="grid grid-cols-2 gap-4">
              <PresetField label="Maximum" presetValue={preset.labourTaxCredit.maxAmount} currentValue={tax.labourTaxCredit.maxAmount} format="currency" onRestore={() => update({ labourTaxCredit: { ...tax.labourTaxCredit, maxAmount: preset.labourTaxCredit.maxAmount } })}>
                <CurrencyInput value={tax.labourTaxCredit.maxAmount} onChange={(v) => update({ labourTaxCredit: { ...tax.labourTaxCredit, maxAmount: v } })} />
              </PresetField>
              <PresetField label="Build-up start" presetValue={preset.labourTaxCredit.buildUpStart} currentValue={tax.labourTaxCredit.buildUpStart ?? 0} format="currency" onRestore={() => update({ labourTaxCredit: { ...tax.labourTaxCredit, buildUpStart: preset.labourTaxCredit.buildUpStart } })}>
                <CurrencyInput value={tax.labourTaxCredit.buildUpStart ?? 0} onChange={(v) => update({ labourTaxCredit: { ...tax.labourTaxCredit, buildUpStart: v } })} />
              </PresetField>
              <PresetField label="Build-up end" tooltip="Income level where labour credit reaches its maximum" presetValue={preset.labourTaxCredit.buildUpEnd} currentValue={tax.labourTaxCredit.buildUpEnd ?? 0} format="currency" onRestore={() => update({ labourTaxCredit: { ...tax.labourTaxCredit, buildUpEnd: preset.labourTaxCredit.buildUpEnd } })}>
                <CurrencyInput value={tax.labourTaxCredit.buildUpEnd ?? 0} onChange={(v) => update({ labourTaxCredit: { ...tax.labourTaxCredit, buildUpEnd: v } })} />
              </PresetField>
              <PresetField label="Phase-out start" presetValue={preset.labourTaxCredit.phaseOutStart} currentValue={tax.labourTaxCredit.phaseOutStart} format="currency" onRestore={() => update({ labourTaxCredit: { ...tax.labourTaxCredit, phaseOutStart: preset.labourTaxCredit.phaseOutStart } })}>
                <CurrencyInput value={tax.labourTaxCredit.phaseOutStart} onChange={(v) => update({ labourTaxCredit: { ...tax.labourTaxCredit, phaseOutStart: v } })} />
              </PresetField>
              <PresetField label="Phase-out end" presetValue={preset.labourTaxCredit.phaseOutEnd} currentValue={tax.labourTaxCredit.phaseOutEnd} format="currency" onRestore={() => update({ labourTaxCredit: { ...tax.labourTaxCredit, phaseOutEnd: preset.labourTaxCredit.phaseOutEnd } })}>
                <CurrencyInput value={tax.labourTaxCredit.phaseOutEnd} onChange={(v) => update({ labourTaxCredit: { ...tax.labourTaxCredit, phaseOutEnd: v } })} />
              </PresetField>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-3">IACK (Combinatiekorting)</h4>
            <p className="text-xs text-muted-foreground mb-3">Working parents with youngest child under 12. Applied automatically when children are configured.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <PresetField label="Maximum" presetValue={preset.iack.maxAmount} currentValue={tax.iack.maxAmount} format="currency" onRestore={() => update({ iack: { ...tax.iack, maxAmount: preset.iack.maxAmount } })}>
                <CurrencyInput value={tax.iack.maxAmount} onChange={(v) => update({ iack: { ...tax.iack, maxAmount: v } })} />
              </PresetField>
              <PresetField label="Income threshold" presetValue={preset.iack.incomeThreshold} currentValue={tax.iack.incomeThreshold} format="currency" onRestore={() => update({ iack: { ...tax.iack, incomeThreshold: preset.iack.incomeThreshold } })}>
                <CurrencyInput value={tax.iack.incomeThreshold} onChange={(v) => update({ iack: { ...tax.iack, incomeThreshold: v } })} />
              </PresetField>
              <PresetField label="Build-up rate" presetValue={preset.iack.buildUpRate} currentValue={tax.iack.buildUpRate} format="percent" onRestore={() => update({ iack: { ...tax.iack, buildUpRate: preset.iack.buildUpRate } })}>
                <PercentInput value={tax.iack.buildUpRate} onChange={(v) => update({ iack: { ...tax.iack, buildUpRate: v } })} />
              </PresetField>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-3">Ouderenkorting</h4>
            <p className="text-xs text-muted-foreground mb-3">Applied automatically once AOW age is reached.</p>
            <div className="grid grid-cols-2 gap-4">
              <PresetField label="Maximum" presetValue={preset.ouderenkorting.maxAmount} currentValue={tax.ouderenkorting.maxAmount} format="currency" onRestore={() => update({ ouderenkorting: { ...tax.ouderenkorting, maxAmount: preset.ouderenkorting.maxAmount } })}>
                <CurrencyInput value={tax.ouderenkorting.maxAmount} onChange={(v) => update({ ouderenkorting: { ...tax.ouderenkorting, maxAmount: v } })} />
              </PresetField>
              <PresetField label="Phase-out start" presetValue={preset.ouderenkorting.phaseOutStart} currentValue={tax.ouderenkorting.phaseOutStart} format="currency" onRestore={() => update({ ouderenkorting: { ...tax.ouderenkorting, phaseOutStart: preset.ouderenkorting.phaseOutStart } })}>
                <CurrencyInput value={tax.ouderenkorting.phaseOutStart} onChange={(v) => update({ ouderenkorting: { ...tax.ouderenkorting, phaseOutStart: v } })} />
              </PresetField>
              <PresetField label="Phase-out rate" presetValue={preset.ouderenkorting.phaseOutRate} currentValue={tax.ouderenkorting.phaseOutRate} format="percent" onRestore={() => update({ ouderenkorting: { ...tax.ouderenkorting, phaseOutRate: preset.ouderenkorting.phaseOutRate } })}>
                <PercentInput value={tax.ouderenkorting.phaseOutRate} onChange={(v) => update({ ouderenkorting: { ...tax.ouderenkorting, phaseOutRate: v } })} />
              </PresetField>
              <PresetField label="Alleenstaande ouderenkorting" tooltip="Fixed credit for single elderly" presetValue={preset.ouderenkorting.alleenstaandAmount} currentValue={tax.ouderenkorting.alleenstaandAmount} format="currency" onRestore={() => update({ ouderenkorting: { ...tax.ouderenkorting, alleenstaandAmount: preset.ouderenkorting.alleenstaandAmount } })}>
                <CurrencyInput value={tax.ouderenkorting.alleenstaandAmount} onChange={(v) => update({ ouderenkorting: { ...tax.ouderenkorting, alleenstaandAmount: v } })} />
              </PresetField>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Jonggehandicaptenkorting</h4>
            <div className="flex items-center gap-3 mb-3">
              <Switch checked={tax.jonggehandicaptEnabled} onCheckedChange={(v) => update({ jonggehandicaptEnabled: v })} />
              <span className="text-sm text-muted-foreground">Apply jonggehandicaptenkorting (disabled from young age, flat credit)</span>
            </div>
            {tax.jonggehandicaptEnabled && (
              <Field label="Amount" tooltip="Flat annual credit for young disabled persons" className="max-w-xs">
                <CurrencyInput value={tax.jonggehandicaptenkorting} onChange={(v) => update({ jonggehandicaptenkorting: v })} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Box 2 */}
      <Card>
        <CardHeader>
          <CardTitle>Box 2 — Substantial Interest</CardTitle>
          <CardDescription>Aanmerkelijk belang — income from ≥5% ownership in a BV (dividends, share sales)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <PresetField label="Lower rate" tooltip="Rate for the first bracket of Box 2 income" presetValue={preset.box2.lowerRate} currentValue={tax.box2.lowerRate} format="percent" onRestore={() => update({ box2: { ...tax.box2, lowerRate: preset.box2.lowerRate } })}>
              <PercentInput value={tax.box2.lowerRate} onChange={(v) => update({ box2: { ...tax.box2, lowerRate: v } })} />
            </PresetField>
            <PresetField label="Bracket limit" tooltip="Upper limit for the lower rate bracket (doubles for couples)" presetValue={preset.box2.lowerBracketLimit} currentValue={tax.box2.lowerBracketLimit} format="currency" onRestore={() => update({ box2: { ...tax.box2, lowerBracketLimit: preset.box2.lowerBracketLimit } })}>
              <CurrencyInput value={tax.box2.lowerBracketLimit} onChange={(v) => update({ box2: { ...tax.box2, lowerBracketLimit: v } })} />
            </PresetField>
            <PresetField label="Upper rate" tooltip="Rate for Box 2 income above the bracket limit" presetValue={preset.box2.upperRate} currentValue={tax.box2.upperRate} format="percent" onRestore={() => update({ box2: { ...tax.box2, upperRate: preset.box2.upperRate } })}>
              <PercentInput value={tax.box2.upperRate} onChange={(v) => update({ box2: { ...tax.box2, upperRate: v } })} />
            </PresetField>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure Box 2 income amount in the Income module.
            {tax.filingType === 'couple' && ' The bracket limit is doubled for couples filing jointly.'}
          </p>
        </CardContent>
      </Card>

      {/* Box 3 */}
      <Card>
        <CardHeader>
          <CardTitle>Box 3 — Wealth Tax</CardTitle>
          <CardDescription>Vermogensrendementsheffing — tax on fictional investment returns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <PresetField label="Tax-free threshold (per person)" tooltip="Heffingsvrij vermogen" presetValue={preset.box3.freeThreshold} currentValue={tax.box3.freeThreshold} format="currency" onRestore={() => update({ box3: { ...tax.box3, freeThreshold: preset.box3.freeThreshold } })}>
              <CurrencyInput value={tax.box3.freeThreshold} onChange={(v) => update({ box3: { ...tax.box3, freeThreshold: v } })} />
            </PresetField>
            <PresetField label="Tax rate on fictional return" presetValue={preset.box3.taxRate} currentValue={tax.box3.taxRate} format="percent" onRestore={() => update({ box3: { ...tax.box3, taxRate: preset.box3.taxRate } })}>
              <PercentInput value={tax.box3.taxRate} onChange={(v) => update({ box3: { ...tax.box3, taxRate: v } })} />
            </PresetField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PresetField label="Debt threshold (per person)" tooltip="Schuldendrempel — debts below this are not deductible in box 3" presetValue={preset.box3.debtThreshold} currentValue={tax.box3.debtThreshold} format="currency" onRestore={() => update({ box3: { ...tax.box3, debtThreshold: preset.box3.debtThreshold } })}>
              <CurrencyInput value={tax.box3.debtThreshold} onChange={(v) => update({ box3: { ...tax.box3, debtThreshold: v } })} />
            </PresetField>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <PresetField label="Savings fictional return" tooltip="Forfaitair rendement for savings" presetValue={preset.box3.savingsRate} currentValue={tax.box3.savingsRate} format="percent" onRestore={() => update({ box3: { ...tax.box3, savingsRate: preset.box3.savingsRate } })}>
              <PercentInput value={tax.box3.savingsRate} onChange={(v) => update({ box3: { ...tax.box3, savingsRate: v } })} />
            </PresetField>
            <PresetField label="Investment fictional return" tooltip="Forfaitair rendement for investments" presetValue={preset.box3.investmentRate} currentValue={tax.box3.investmentRate} format="percent" onRestore={() => update({ box3: { ...tax.box3, investmentRate: preset.box3.investmentRate } })}>
              <PercentInput value={tax.box3.investmentRate} onChange={(v) => update({ box3: { ...tax.box3, investmentRate: v } })} />
            </PresetField>
            <PresetField label="Debt deduction rate" presetValue={preset.box3.debtRate} currentValue={tax.box3.debtRate} format="percent" onRestore={() => update({ box3: { ...tax.box3, debtRate: preset.box3.debtRate } })}>
              <PercentInput value={tax.box3.debtRate} onChange={(v) => update({ box3: { ...tax.box3, debtRate: v } })} />
            </PresetField>
          </div>
        </CardContent>
      </Card>

      {/* Social Contributions */}
      <Card>
        <CardHeader>
          <CardTitle>Social Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <PresetField label="ZVW Rate" tooltip="Zorgverzekeringswet contribution rate" presetValue={preset.socialContributions.zvwRate} currentValue={tax.socialContributions.zvwRate} format="percent" onRestore={() => update({ socialContributions: { ...tax.socialContributions, zvwRate: preset.socialContributions.zvwRate } })}>
              <PercentInput value={tax.socialContributions.zvwRate} onChange={(v) => update({ socialContributions: { ...tax.socialContributions, zvwRate: v } })} />
            </PresetField>
            <PresetField label="ZVW Max Income" tooltip="Maximum income for ZVW contribution" presetValue={preset.socialContributions.zvwMaxIncome} currentValue={tax.socialContributions.zvwMaxIncome} format="currency" onRestore={() => update({ socialContributions: { ...tax.socialContributions, zvwMaxIncome: preset.socialContributions.zvwMaxIncome } })}>
              <CurrencyInput value={tax.socialContributions.zvwMaxIncome} onChange={(v) => update({ socialContributions: { ...tax.socialContributions, zvwMaxIncome: v } })} />
            </PresetField>
          </div>
        </CardContent>
      </Card>

      {/* Eigenwoningforfait */}
      <Card>
        <CardHeader>
          <CardTitle>Eigenwoningforfait</CardTitle>
          <CardDescription>Deemed rental value for owner-occupied homes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <PresetField label="Rate" tooltip="Percentage of WOZ value added as income" presetValue={preset.eigenwoningforfaitRate} currentValue={tax.eigenwoningforfaitRate} format="percent" onRestore={() => update({ eigenwoningforfaitRate: preset.eigenwoningforfaitRate })}>
              <PercentInput value={tax.eigenwoningforfaitRate} onChange={(v) => update({ eigenwoningforfaitRate: v })} />
            </PresetField>
            <PresetField label="Threshold" tooltip="WOZ value above which a higher rate applies" presetValue={preset.eigenwoningforfaitThreshold} currentValue={tax.eigenwoningforfaitThreshold} format="currency" onRestore={() => update({ eigenwoningforfaitThreshold: preset.eigenwoningforfaitThreshold })}>
              <CurrencyInput value={tax.eigenwoningforfaitThreshold} onChange={(v) => update({ eigenwoningforfaitThreshold: v })} />
            </PresetField>
          </div>
        </CardContent>
      </Card>

      {/* Self-Employment Deductions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Self-Employment Deductions
          </CardTitle>
          <CardDescription>
            Zelfstandigenaftrek, startersaftrek &amp; MKB-winstvrijstelling — applied when any side income is flagged as self-employed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <PresetField label="Zelfstandigenaftrek" tooltip="Annual flat deduction for qualifying self-employed (≥1,225 hours/year)" presetValue={preset.selfEmployment.zelfstandigenaftrek} currentValue={se.zelfstandigenaftrek} format="currency" onRestore={() => updateSE({ zelfstandigenaftrek: preset.selfEmployment.zelfstandigenaftrek })}>
              <CurrencyInput value={se.zelfstandigenaftrek} onChange={(v) => updateSE({ zelfstandigenaftrek: v })} />
            </PresetField>
            <PresetField label="MKB-winstvrijstelling" tooltip="Percentage of profit exempt after zelfstandigenaftrek" presetValue={preset.selfEmployment.mkbWinstvrijstelling} currentValue={se.mkbWinstvrijstelling} format="percent" onRestore={() => updateSE({ mkbWinstvrijstelling: preset.selfEmployment.mkbWinstvrijstelling })}>
              <PercentInput value={se.mkbWinstvrijstelling} onChange={(v) => updateSE({ mkbWinstvrijstelling: v })} />
            </PresetField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PresetField label="Startersaftrek" tooltip="Extra deduction for first 3 years of self-employment" presetValue={preset.selfEmployment.startersaftrek} currentValue={se.startersaftrek} format="currency" onRestore={() => updateSE({ startersaftrek: preset.selfEmployment.startersaftrek })}>
              <CurrencyInput value={se.startersaftrek} onChange={(v) => updateSE({ startersaftrek: v })} />
            </PresetField>
            <Field label="Starter status" tooltip="First 3 years qualify for startersaftrek">
              <div className="flex items-center gap-2 h-9">
                <Switch checked={se.isStarter} onCheckedChange={(c) => updateSE({ isStarter: c === true })} />
                <span className="text-sm">{se.isStarter ? 'Yes' : 'No'}</span>
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Tax Optimizations */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Optimizations</CardTitle>
          <CardDescription>Deductions and strategies to reduce your tax burden</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lijfrente / Jaarruimte */}
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <PiggyBank className="h-4 w-4" /> Lijfrente (Annuity Pension)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Contributions to a lijfrente (annuity) are deductible from Box 1 income, up to the jaarruimte limit.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Annual contribution" tooltip="Your annual lijfrente contribution (deductible up to jaarruimte)">
                <CurrencyInput value={opt.lijfrenteAnnualContribution} onChange={(v) => updateOpt({ lijfrenteAnnualContribution: v })} />
              </Field>
              <Field label="Computed jaarruimte" tooltip="Maximum deductible amount based on your income">
                <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(calculateJaarruimte(scenario.income.grossSalary * (1 + scenario.income.holidayAllowance), tax))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
              <Field label="Jaarruimte %" tooltip="Percentage of income for jaarruimte calculation">
                <PercentInput value={opt.jaarruimtePercent} onChange={(v) => updateOpt({ jaarruimtePercent: v })} />
              </Field>
              <Field label="Franchise" tooltip="Income threshold (AOW franchise)">
                <CurrencyInput value={opt.jaarruimteThreshold} onChange={(v) => updateOpt({ jaarruimteThreshold: v })} />
              </Field>
              <Field label="Max deduction" tooltip="Absolute maximum jaarruimte">
                <CurrencyInput value={opt.jaarruimteMax} onChange={(v) => updateOpt({ jaarruimteMax: v })} />
              </Field>
            </div>
            <Field label="Factor A (pension accrual)" tooltip="Annual pension accrual from employer. Set to 0 if no employer pension." className="mt-3 max-w-xs">
              <CurrencyInput value={opt.factorA} onChange={(v) => updateOpt({ factorA: v })} />
            </Field>
          </div>

          <Separator />

          {/* Hillen Arrangement */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Home className="h-4 w-4" /> Hillen Arrangement
              </h4>
              <Switch
                checked={opt.hillenEnabled}
                onCheckedChange={(c) => updateOpt({ hillenEnabled: c === true })}
              />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Relief when eigenwoningforfait exceeds mortgage interest (e.g. mortgage fully paid off).
              Being phased out over 30 years ({opt.hillenStartYear}–{opt.hillenStartYear + opt.hillenPhaseOutYears}).
            </p>
            {opt.hillenEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phase-out start year">
                  <Input
                    type="number"
                    value={opt.hillenStartYear}
                    onChange={(e) => updateOpt({ hillenStartYear: parseInt(e.target.value) || 2019 })}
                  />
                </Field>
                <Field label="Phase-out duration (years)">
                  <Input
                    type="number"
                    value={opt.hillenPhaseOutYears}
                    onChange={(e) => updateOpt({ hillenPhaseOutYears: parseInt(e.target.value) || 30 })}
                  />
                </Field>
              </div>
            )}
          </div>

          <Separator />

          {/* Giftenaftrek */}
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Gift className="h-4 w-4" /> Giftenaftrek (Charitable Deductions)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Regular gifts deductible above 1% of income (max 10%). Periodieke giften (5-year commitment) are fully deductible.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Regular gifts (annual)" tooltip="Deductible above threshold, max 10% of income">
                <CurrencyInput value={opt.giftenRegular} onChange={(v) => updateOpt({ giftenRegular: v })} />
              </Field>
              <Field label="Periodieke giften (annual)" tooltip="Fully deductible — requires 5-year notarized commitment">
                <CurrencyInput value={opt.giftenPeriodiek} onChange={(v) => updateOpt({ giftenPeriodiek: v })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Field label="Threshold %" tooltip="Minimum percentage of income before regular gifts become deductible">
                <PercentInput value={opt.giftenThresholdPercent} onChange={(v) => updateOpt({ giftenThresholdPercent: v })} />
              </Field>
              <Field label="Maximum %" tooltip="Maximum percentage of income deductible for regular gifts">
                <PercentInput value={opt.giftenMaxPercent} onChange={(v) => updateOpt({ giftenMaxPercent: v })} />
              </Field>
            </div>
          </div>

          <Separator />

          {/* Alimentatie (Spousal Alimony) */}
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Alimentatie (Spousal Alimony)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Annual spousal alimony (partneralimentatie) paid to an ex-partner is fully deductible from Box 1 income.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Annual alimentatie paid" tooltip="Total spousal alimony paid per year — fully deductible">
                <CurrencyInput value={opt.alimentatie} onChange={(v) => updateOpt({ alimentatie: v })} />
              </Field>
            </div>
          </div>

          <Separator />

          {/* Green Investments */}
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Leaf className="h-4 w-4" /> Green Investments (Box 3)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Certified green investments are exempt from Box 3 wealth tax (up to {formatCurrency(opt.greenExemptionPerPerson)}/person)
              and receive a {formatPercent(opt.greenTaxCredit)} income tax credit.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Green investment amount" tooltip="Total invested in certified green funds">
                <CurrencyInput value={opt.greenInvestments} onChange={(v) => updateOpt({ greenInvestments: v })} />
              </Field>
              <Field label="Exemption per person" tooltip="Box 3 exemption limit per person">
                <CurrencyInput value={opt.greenExemptionPerPerson} onChange={(v) => updateOpt({ greenExemptionPerPerson: v })} />
              </Field>
              <Field label="Tax credit rate" tooltip="Income tax credit on green investment amount">
                <PercentInput value={opt.greenTaxCredit} onChange={(v) => updateOpt({ greenTaxCredit: v })} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>
    </ModuleLayout>
  );
}
