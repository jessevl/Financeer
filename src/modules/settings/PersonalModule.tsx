import { useActiveScenario, useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, PercentInput } from '@/components/common/FormFields';
import { ModuleHint } from '@/components/common/ModuleHint';
import { Settings, Globe, Scale, Users } from 'lucide-react';
import type { GlobalSettings, TaxConfig } from '@/types';
import { TaxLawVerificationBox } from './TaxLawVerificationBox';

export function PersonalModule() {
  const scenario = useActiveScenario();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateTax = useStore((s) => s.updateTax);
  const updateIncome = useStore((s) => s.updateIncome);

  const update = (changes: Partial<GlobalSettings>) => {
    updateSettings(changes);
  };

  const updateHousehold = (filingType: TaxConfig['filingType']) => {
    updateTax(scenario.id, { ...scenario.tax, filingType });

    if (filingType === 'single' && scenario.income.hasPartner) {
      updateIncome(scenario.id, { ...scenario.income, hasPartner: false });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Personal</h2>
        <p className="text-[var(--color-text-secondary)] mt-1">Your personal details and financial assumptions.</p>
      </div>

      <ModuleHint id="personal">
        These settings affect the entire simulation. Your date of birth determines your age each year, partner birth date and longevity assumptions drive survivor pension horizons, inflation adjusts future values, and the tax law year controls which tax brackets and thresholds are used. The simulation runs from now until your end age.
      </ModuleHint>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Date of Birth" tooltip="Used to calculate your age for the simulation timeline">
            <Input type="date" value={settings.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })} className="max-w-xs" />
          </Field>
          <Field label="Simulation End Age" tooltip="The age at which the simulation stops projecting">
            <Input type="number" value={settings.simulationEndAge || ''} onChange={(e) => update({ simulationEndAge: parseInt(e.target.value) || 90 })} className="max-w-xs" />
          </Field>
          <Field label="Assumed Age at Death" tooltip="Used for lifetime pension and lijfrente payout horizons." className="max-w-xs">
            <Input type="number" value={settings.lifeExpectancyAge || ''} onChange={(e) => update({ lifeExpectancyAge: parseInt(e.target.value) || 90 })} className="max-w-xs" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Household status" tooltip="Used for AOW assumptions, Box 3 exemptions, toeslagen thresholds, and other couple vs single rules." className="max-w-xs">
            <Select value={scenario.tax.filingType} onValueChange={(value) => updateHousehold(value as TaxConfig['filingType'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="couple">Couple / fiscal partners</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {scenario.tax.filingType === 'couple' && (
            <>
              <Field label="Partner Date of Birth" tooltip="Used to model survivor pension and lijfrente continuation when partner payouts continue after your assumed death.">
                <Input type="date" value={settings.partnerDateOfBirth} onChange={(e) => update({ partnerDateOfBirth: e.target.value })} className="max-w-xs" />
              </Field>
              <Field label="Partner Assumed Age at Death" tooltip="Used together with partner date of birth for survivor payout horizons." className="max-w-xs">
                <Input type="number" value={settings.partnerLifeExpectancyAge || ''} onChange={(e) => update({ partnerLifeExpectancyAge: parseInt(e.target.value) || 90 })} className="max-w-xs" />
              </Field>
            </>
          )}
          <p className="text-sm text-[var(--color-text-secondary)]">
            Partner income is configured separately in the Income module, so you can model a couple with one income. If partner date of birth is left empty, Financeer assumes the partner has the same age as you for survivor pension estimates.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Financial Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Inflation Rate" tooltip="Annual inflation rate applied to expenses" className="max-w-xs">
            <PercentInput value={settings.inflationRate} onChange={(v) => update({ inflationRate: v })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Tax Law Year
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            This drives the default tax brackets, credits, and toeslagen parameters across all modules.
          </p>
          <Field label="Tax Law Year" tooltip="When changed, you can reset Tax and Toeslagen to the new year's preset values" className="max-w-xs">
            <Select value={String(settings.taxLawYear)} onValueChange={(v) => update({ taxLawYear: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <TaxLawVerificationBox />
    </div>
  );
}
