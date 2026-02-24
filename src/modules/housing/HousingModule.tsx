import { useStore, useActiveScenario } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { HousingCalcSidebar } from './HousingCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Home, Building, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useState } from 'react';
import type { Property, MortgageConfig } from '@/types';
import { formatCurrency } from '@/lib/format';
import { generateAmortisationSchedule } from '@/engine/mortgage';

function createDefaultMortgage(label = 'Mortgage'): MortgageConfig {
  return {
    id: uuidv4(),
    label,
    type: 'annuity',
    principal: 280000,
    interestRate: 0.039,
    fixedRatePeriod: 10,
    variableRateAfter: 0.05,
    termYears: 30,
    startDate: new Date().toISOString().slice(0, 10),
    deductibilityStartDate: new Date().toISOString().slice(0, 10),
    extraRepayments: [],
    nhg: false,
  };
}

function estimatePayment(m: MortgageConfig): number {
  if (m.principal <= 0 || m.termYears <= 0) return 0;
  const effectiveRate = m.nhg ? Math.max(0, m.interestRate - 0.006) : m.interestRate;
  const r = effectiveRate / 12;
  const n = m.termYears * 12;
  if (m.type === 'interest-only') return m.principal * r;
  if (m.type === 'linear') return m.principal / n + m.principal * r;
  if (r === 0) return m.principal / n;
  return m.principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function MortgageCard({
  mortgage,
  onUpdate,
  canRemove,
  onRemove,
}: {
  mortgage: MortgageConfig;
  onUpdate: (m: MortgageConfig) => void;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const update = (changes: Partial<MortgageConfig>) => onUpdate({ ...mortgage, ...changes });
  const [showSchedule, setShowSchedule] = useState(false);

  // Aggregate amortisation to annual summaries for the table
  const annualSchedule = (() => {
    if (!showSchedule) return [];
    const schedule = generateAmortisationSchedule(mortgage);
    const yearMap = new Map<number, { interest: number; principal: number; balance: number }>();
    for (const entry of schedule) {
      const year = Math.ceil(entry.month / 12);
      const prev = yearMap.get(year) ?? { interest: 0, principal: 0, balance: 0 };
      prev.interest += entry.interest;
      prev.principal += entry.principal;
      prev.balance = entry.remainingBalance;
      yearMap.set(year, prev);
    }
    return [...yearMap.entries()].map(([year, data]) => ({ year, ...data }));
  })();

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Field label="Label" className="flex-1 max-w-xs">
          <Input value={mortgage.label} onChange={(e) => update({ label: e.target.value })} />
        </Field>
        {canRemove && (
          <Button variant="ghost" size="icon" className="text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <Select value={mortgage.type} onValueChange={(v) => update({ type: v as MortgageConfig['type'] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="annuity">Annuity (Annuïtair)</SelectItem>
              <SelectItem value="linear">Linear (Lineair)</SelectItem>
              <SelectItem value="interest-only">Interest-only (Aflossingsvrij)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Principal">
          <CurrencyInput value={mortgage.principal} onChange={(v) => update({ principal: v })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Interest rate">
          <PercentInput value={mortgage.interestRate} onChange={(v) => update({ interestRate: v })} />
        </Field>
        <Field label="Fixed-rate period (yr)">
          <Input
            type="number"
            value={mortgage.fixedRatePeriod}
            onChange={(e) => update({ fixedRatePeriod: parseInt(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Rate after fixed period">
          <PercentInput value={mortgage.variableRateAfter} onChange={(v) => update({ variableRateAfter: v })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Term (years)">
          <Input
            type="number"
            value={mortgage.termYears}
            onChange={(e) => update({ termYears: parseInt(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Start date">
          <Input type="date" value={mortgage.startDate} onChange={(e) => update({ startDate: e.target.value })} />
        </Field>
        <Field label="NHG">
          <div className="flex items-center gap-2 h-9">
            <Switch checked={mortgage.nhg} onCheckedChange={(c) => update({ nhg: c === true })} />
            <Label className="text-sm">{mortgage.nhg ? 'Yes' : 'No'}</Label>
          </div>
        </Field>
      </div>

      {/* 30-year deductibility clock */}
      {(() => {
        const dedStart = new Date(mortgage.deductibilityStartDate || mortgage.startDate);
        const now = new Date();
        const elapsedMonths = (now.getFullYear() - dedStart.getFullYear()) * 12 + (now.getMonth() - dedStart.getMonth());
        const remainingMonths = Math.max(0, 360 - elapsedMonths);
        const remainingYears = Math.floor(remainingMonths / 12);
        const remainingMo = remainingMonths % 12;
        const pct = Math.min(100, (elapsedMonths / 360) * 100);
        return (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className={`h-4 w-4 ${remainingMonths > 0 ? 'text-green-600' : 'text-amber-600'}`} />
                30-Year Interest Deductibility
              </div>
              <span className={`text-xs font-medium ${remainingMonths > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {remainingMonths > 0 ? `${remainingYears}y ${remainingMo}m remaining` : 'Expired'}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${remainingMonths > 0 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Deductibility start date" tooltip="Start of the 30-year mortgage interest deduction period. May differ from mortgage start for refinanced mortgages.">
                <Input type="date" value={mortgage.deductibilityStartDate || mortgage.startDate} onChange={(e) => update({ deductibilityStartDate: e.target.value })} />
              </Field>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Est. monthly payment: <span className="font-medium text-foreground">{formatCurrency(estimatePayment(mortgage))}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowSchedule(!showSchedule)} className="text-xs">
          {showSchedule ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
          {showSchedule ? 'Hide' : 'Show'} amortisation
        </Button>
      </div>

      {showSchedule && annualSchedule.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-medium">Year</th>
                <th className="px-2 py-1.5 font-medium text-right">Interest</th>
                <th className="px-2 py-1.5 font-medium text-right">Principal</th>
                <th className="px-2 py-1.5 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {annualSchedule.map((row) => (
                <tr key={row.year} className="border-t">
                  <td className="px-2 py-1">{row.year}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(row.interest)}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(row.principal)}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Extra Repayments */}
      {mortgage.extraRepayments.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wide mb-2">Extra Repayments</h5>
          {mortgage.extraRepayments.map((rep, i) => (
            <div key={rep.id} className="flex items-end gap-2 mb-2">
              <Field label={i === 0 ? 'Date' : ''} className="w-36">
                <Input
                  type="date"
                  value={rep.date}
                  onChange={(e) => {
                    const reps = [...mortgage.extraRepayments];
                    reps[i] = { ...rep, date: e.target.value };
                    update({ extraRepayments: reps });
                  }}
                />
              </Field>
              <Field label={i === 0 ? 'Amount' : ''} className="w-36">
                <CurrencyInput
                  value={rep.amount}
                  onChange={(v) => {
                    const reps = [...mortgage.extraRepayments];
                    reps[i] = { ...rep, amount: v };
                    update({ extraRepayments: reps });
                  }}
                />
              </Field>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => {
                  update({ extraRepayments: mortgage.extraRepayments.filter((_, j) => j !== i) });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          update({
            extraRepayments: [
              ...mortgage.extraRepayments,
              { id: uuidv4(), date: new Date().toISOString().slice(0, 10), amount: 10000 },
            ],
          })
        }
      >
        + Extra Repayment
      </Button>
    </div>
  );
}

function PropertyCard({
  property,
  onUpdate,
  onRemove,
}: {
  property: Property;
  onUpdate: (p: Property) => void;
  onRemove: () => void;
}) {
  const update = (changes: Partial<Property>) => onUpdate({ ...property, ...changes });

  const updateMortgage = (mortgageId: string, m: MortgageConfig) => {
    update({ mortgages: property.mortgages.map((mtg) => (mtg.id === mortgageId ? m : mtg)) });
  };

  const addMortgage = () => {
    const label = `Mortgage ${property.mortgages.length + 1}`;
    update({ mortgages: [...property.mortgages, createDefaultMortgage(label)] });
  };

  const removeMortgage = (mortgageId: string) => {
    update({ mortgages: property.mortgages.filter((m) => m.id !== mortgageId) });
  };

  const totalPayment = property.mortgages.reduce((sum, m) => sum + estimatePayment(m), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {property.isOwnerOccupied ? <Home className="h-5 w-5" /> : <Building className="h-5 w-5" />}
            <Input
              value={property.label}
              onChange={(e) => update({ label: e.target.value })}
              className="font-semibold text-base border-none p-0 h-auto focus-visible:ring-0 max-w-xs"
            />
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-1" /> Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current value">
            <CurrencyInput value={property.value} onChange={(v) => update({ value: v })} />
          </Field>
          <Field label="Annual appreciation">
            <PercentInput value={property.appreciationRate} onChange={(v) => update({ appreciationRate: v })} />
          </Field>
          <Field label="WOZ value" tooltip="Waardering Onroerende Zaken — used for tax calculation">
            <CurrencyInput value={property.wozValue} onChange={(v) => update({ wozValue: v })} />
          </Field>
          <Field label="Owner-occupied">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={property.isOwnerOccupied} onCheckedChange={(c) => update({ isOwnerOccupied: c === true })} />
              <Label className="text-sm">{property.isOwnerOccupied ? 'Yes (eigen woning)' : 'No (investment)'}</Label>
            </div>
          </Field>
        </div>

        {!property.isOwnerOccupied && (
          <Field label="Monthly rental income">
            <CurrencyInput value={property.rentalIncome} onChange={(v) => update({ rentalIncome: v })} />
          </Field>
        )}

        <Separator />

        {/* Mortgages */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">
              Mortgages ({property.mortgages.length})
              {property.mortgages.length > 1 && (
                <span className="font-normal text-muted-foreground ml-2">
                  Total: {formatCurrency(totalPayment)}/mo
                </span>
              )}
            </h4>
            <Button variant="outline" size="sm" onClick={addMortgage}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Mortgage
            </Button>
          </div>

          <div className="space-y-4">
            {property.mortgages.map((mtg) => (
              <MortgageCard
                key={mtg.id}
                mortgage={mtg}
                onUpdate={(m) => updateMortgage(mtg.id, m)}
                canRemove={property.mortgages.length > 1}
                onRemove={() => removeMortgage(mtg.id)}
              />
            ))}
          </div>

          {property.mortgages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No mortgages. Property is fully paid off.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function HousingModule() {
  const scenario = useActiveScenario();
  const updateHousing = useStore((s) => s.updateHousing);
  const housing = scenario.housing;

  const addProperty = () => {
    const newProp: Property = {
      id: uuidv4(),
      label: `Property ${housing.properties.length + 1}`,
      value: 350000,
      appreciationRate: 0.03,
      mortgages: [createDefaultMortgage()],
      wozValue: 300000,
      isOwnerOccupied: true,
      rentalIncome: 0,
    };
    updateHousing(scenario.id, {
      properties: [...housing.properties, newProp],
    });
  };

  const updateProperty = (propId: string, p: Property) => {
    updateHousing(scenario.id, {
      properties: housing.properties.map((prop) => (prop.id === propId ? p : prop)),
    });
  };

  const removeProperty = (propId: string) => {
    updateHousing(scenario.id, {
      properties: housing.properties.filter((p) => p.id !== propId),
    });
  };

  return (
    <ModuleLayout sidebar={<HousingCalcSidebar />}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Housing</h2>
          <p className="text-muted-foreground mt-1">Properties, mortgages &amp; housing costs.</p>
        </div>
        <Button onClick={addProperty}>
          <Plus className="h-4 w-4 mr-2" /> Add Property
        </Button>
      </div>

      <ModuleHint id="housing">
        Add your properties and mortgages here. Financeer calculates HRA (hypotheekrenteaftrek), eigenwoningforfait, and tracks your mortgage amortisation over time. You can add multiple properties and mortgages — the sidebar shows your total housing costs.
      </ModuleHint>

      {housing.properties.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Home className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No properties configured. Add one to get started.</p>
          </CardContent>
        </Card>
      )}

      {housing.properties.map((prop) => (
        <PropertyCard
          key={prop.id}
          property={prop}
          onUpdate={(p) => updateProperty(prop.id, p)}
          onRemove={() => removeProperty(prop.id)}
        />
      ))}
    </ModuleLayout>
  );
}
