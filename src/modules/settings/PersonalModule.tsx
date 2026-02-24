import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, PercentInput } from '@/components/common/FormFields';
import { ModuleHint } from '@/components/common/ModuleHint';
import { Settings, Globe, Scale } from 'lucide-react';
import type { GlobalSettings } from '@/types';
import { TaxLawVerificationBox } from './TaxLawVerificationBox';

export function PersonalModule() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const update = (changes: Partial<GlobalSettings>) => {
    updateSettings(changes);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Personal</h2>
        <p className="text-[var(--color-text-secondary)] mt-1">Your personal details and financial assumptions.</p>
      </div>

      <ModuleHint id="personal">
        These settings affect the entire simulation. Your date of birth determines your age each year, the inflation rate adjusts future values, and the tax law year controls which tax brackets and thresholds are used. The simulation runs from now until your end age.
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
