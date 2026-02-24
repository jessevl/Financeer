import { useStore, useActiveScenario } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { IncomeCalcSidebar } from './IncomeCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Briefcase, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { IncomeConfig, SideIncome, CareerEvent } from '@/types';

export function IncomeModule() {
  const scenario = useActiveScenario();
  const updateIncome = useStore((s) => s.updateIncome);
  const income = scenario.income;

  const update = (changes: Partial<IncomeConfig>) => {
    updateIncome(scenario.id, { ...income, ...changes });
  };

  const addSideIncome = () => {
    update({
      sideIncomes: [...income.sideIncomes, {
        id: uuidv4(), label: '', grossAmount: 0, frequency: 'monthly', isSelfEmployed: false,
      }],
    });
  };

  const updateSideIncome = (id: string, changes: Partial<SideIncome>) => {
    update({
      sideIncomes: income.sideIncomes.map((s) => s.id === id ? { ...s, ...changes } : s),
    });
  };

  const removeSideIncome = (id: string) => {
    update({ sideIncomes: income.sideIncomes.filter((s) => s.id !== id) });
  };

  const addCareerEvent = () => {
    update({
      careerEvents: [...income.careerEvents, {
        id: uuidv4(), date: '', label: '', newGrossSalary: income.grossSalary, isPartner: false,
      }],
    });
  };

  const updateCareerEvent = (id: string, changes: Partial<CareerEvent>) => {
    update({
      careerEvents: income.careerEvents.map((e) => e.id === id ? { ...e, ...changes } : e),
    });
  };

  const removeCareerEvent = (id: string) => {
    update({ careerEvents: income.careerEvents.filter((e) => e.id !== id) });
  };

  return (
    <ModuleLayout sidebar={<IncomeCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Income</h2>
        <p className="text-muted-foreground mt-1">Configure your salary, bonuses, and other income sources.</p>
      </div>

      <ModuleHint id="income">
        Enter your gross annual salary and holiday allowance. You can also add side income, partner income, and career events (raises, job changes) that affect future years. The calculation panel on the right shows your real-time net income breakdown.
      </ModuleHint>

      {/* Primary Income */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Primary Income
          </CardTitle>
          <CardDescription>Your main employment income</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Gross Annual Salary" tooltip="Your total annual salary before tax">
              <CurrencyInput value={income.grossSalary} onChange={(v) => update({ grossSalary: v })} />
            </Field>
            <Field label="Holiday Allowance" tooltip="Vakantiegeld — typically 8% of gross salary in NL">
              <PercentInput value={income.holidayAllowance} onChange={(v) => update({ holidayAllowance: v })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Annual Merit Increase" tooltip="Expected annual salary raise percentage">
              <PercentInput value={income.meritIncreaseRate} onChange={(v) => update({ meritIncreaseRate: v })} />
            </Field>
            <Field label="Annual Bonus" tooltip="Expected annual bonus (gross)">
              <CurrencyInput value={income.bonusAmount} onChange={(v) => update({ bonusAmount: v })} />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={income.thirteenthMonth}
              onCheckedChange={(v) => update({ thirteenthMonth: v })}
            />
            <Label>13th month salary</Label>
          </div>
          {income.thirteenthMonth && (
            <Field label="13th Month Amount" tooltip="Custom amount for 13th month. Leave at 0 to use salary ÷ 12." className="max-w-xs">
              <CurrencyInput value={income.thirteenthMonthAmount} onChange={(v) => update({ thirteenthMonthAmount: v })} />
            </Field>
          )}

          <Separator />

          <Field label="Box 2 Income (Substantial Interest)" tooltip="Annual dividends or profits from a BV where you own ≥5%. Taxed separately in Box 2." className="max-w-xs">
            <CurrencyInput value={income.box2Income ?? 0} onChange={(v) => update({ box2Income: v })} />
          </Field>
        </CardContent>
      </Card>

      {/* Partner Income */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Partner Income
            </CardTitle>
            <Switch
              checked={income.hasPartner}
              onCheckedChange={(v) => update({ hasPartner: v })}
            />
          </div>
        </CardHeader>
        {income.hasPartner && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Partner Gross Salary">
                <CurrencyInput value={income.partnerGrossSalary} onChange={(v) => update({ partnerGrossSalary: v })} />
              </Field>
              <Field label="Partner Holiday Allowance">
                <PercentInput value={income.partnerHolidayAllowance} onChange={(v) => update({ partnerHolidayAllowance: v })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Partner Merit Increase">
                <PercentInput value={income.partnerMeritIncreaseRate} onChange={(v) => update({ partnerMeritIncreaseRate: v })} />
              </Field>
              <Field label="Partner Annual Bonus">
                <CurrencyInput value={income.partnerBonusAmount} onChange={(v) => update({ partnerBonusAmount: v })} />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={income.partnerThirteenthMonth}
                onCheckedChange={(v) => update({ partnerThirteenthMonth: v })}
              />
              <Label>Partner 13th month salary</Label>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Side Income */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Side Income</CardTitle>
            <Button variant="outline" size="sm" onClick={addSideIncome}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Freelance, rental, or other income sources</CardDescription>
        </CardHeader>
        {income.sideIncomes.length > 0 && (
          <CardContent className="space-y-3">
            {income.sideIncomes.map((si) => (
              <div key={si.id} className="p-3 rounded-lg bg-muted/50 space-y-3">
                <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                  <Field label="Label" className="flex-1 min-w-[120px]">
                    <Input value={si.label} onChange={(e) => updateSideIncome(si.id, { label: e.target.value })} placeholder="e.g. Freelancing" />
                  </Field>
                  <Field label="Gross Amount" className="w-32 sm:w-36">
                    <CurrencyInput value={si.grossAmount} onChange={(v) => updateSideIncome(si.id, { grossAmount: v })} />
                  </Field>
                  <Field label="Frequency" className="w-28 sm:w-32">
                    <Select value={si.frequency} onValueChange={(v) => updateSideIncome(si.id, { frequency: v as SideIncome['frequency'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeSideIncome(si.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={si.isSelfEmployed}
                    onCheckedChange={(v) => updateSideIncome(si.id, { isSelfEmployed: v })}
                  />
                  <Label className="text-sm">Self-employed (ZZP)</Label>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Career Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Career Events</CardTitle>
            <Button variant="outline" size="sm" onClick={addCareerEvent}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Planned salary changes at specific future dates</CardDescription>
        </CardHeader>
        {income.careerEvents.length > 0 && (
          <CardContent className="space-y-3">
            {income.careerEvents.map((ce) => (
              <div key={ce.id} className="flex flex-wrap items-end gap-2 sm:gap-3 p-3 rounded-lg bg-muted/50">
                <Field label="Date" className="w-36 sm:w-40">
                  <Input type="month" value={ce.date} onChange={(e) => updateCareerEvent(ce.id, { date: e.target.value })} />
                </Field>
                <Field label="Label" className="flex-1 min-w-[120px]">
                  <Input value={ce.label} onChange={(e) => updateCareerEvent(ce.id, { label: e.target.value })} placeholder="e.g. Promotion" />
                </Field>
                <Field label="New Salary" className="w-32 sm:w-36">
                  <CurrencyInput value={ce.newGrossSalary} onChange={(v) => updateCareerEvent(ce.id, { newGrossSalary: v })} />
                </Field>
                {income.hasPartner && (
                  <div className="flex items-center gap-2 pb-1">
                    <Switch
                      checked={ce.isPartner}
                      onCheckedChange={(v) => updateCareerEvent(ce.id, { isPartner: v as boolean })}
                    />
                    <Label className="text-xs whitespace-nowrap">Partner</Label>
                  </div>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeCareerEvent(ce.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </ModuleLayout>
  );
}
