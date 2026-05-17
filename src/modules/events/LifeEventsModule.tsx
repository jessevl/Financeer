import { useStore, useActiveScenario } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { ModuleHint } from '@/components/common/ModuleHint';
import { Plus, Trash2, Calendar, Briefcase, Home, Baby, Gift, Coffee, Users, Zap } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { ChildcareArrangement, LifeEvent, LifeEventType, MortgageConfig } from '@/types';
import { createDefaultLifeEvent, genericLifeEventTypes, normalizeLifeEvents } from '@/lib/lifeEvents';

const eventTypeConfig: Record<LifeEventType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; helper: string }> = {
  salary_change: {
    label: 'Salary Change',
    icon: Briefcase,
    color: 'text-blue-500',
    helper: 'Sets or adjusts annual salary directly from the chosen month onward.',
  },
  career_break: {
    label: 'Career Break',
    icon: Coffee,
    color: 'text-orange-500',
    helper: 'Calculates reduced income for a fixed duration using a replacement-rate percentage.',
  },
  child_born: {
    label: 'Child Born',
    icon: Baby,
    color: 'text-pink-500',
    helper: 'Adds a child with base child costs and optional childcare arrangements from that month onward.',
  },
  partner_change: {
    label: 'Partner Change',
    icon: Users,
    color: 'text-purple-500',
    helper: 'Turns partner income on or off and applies any household cost adjustment from that date onward.',
  },
  cash_windfall: {
    label: 'Cash Windfall',
    icon: Gift,
    color: 'text-amber-500',
    helper: 'Adds a one-time positive cash inflow such as an inheritance, bonus, or gift.',
  },
  one_time_expense: {
    label: 'One-time Expense',
    icon: Zap,
    color: 'text-cyan-500',
    helper: 'Subtracts a one-time cash outflow such as a renovation, tax bill, or purchase.',
  },
  buy_property: {
    label: 'Buy Property',
    icon: Home,
    color: 'text-green-500',
    helper: 'Calculates down payment plus purchase costs, then adds the new property and mortgage(s) to the simulation.',
  },
  sell_property: {
    label: 'Sell Property',
    icon: Home,
    color: 'text-emerald-500',
    helper: 'Calculates sale proceeds as sale price minus remaining mortgage balance and selling costs.',
  },
};

const eventTypeOrder: LifeEventType[] = [...genericLifeEventTypes];

function ChildcareArrangementEditor({
  arrangements,
  onChange,
}: {
  arrangements: ChildcareArrangement[];
  onChange: (arrangements: ChildcareArrangement[]) => void;
}) {
  const updateArrangement = (id: string, changes: Partial<ChildcareArrangement>) => {
    onChange(arrangements.map((arrangement) => (arrangement.id === id ? { ...arrangement, ...changes } : arrangement)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Childcare arrangements</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onChange([
              ...arrangements,
              {
                id: uuidv4(),
                type: 'daycare',
                hoursPerMonth: 0,
                hourlyRate: 0,
              },
            ]);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Childcare
        </Button>
      </div>
      {arrangements.length === 0 && (
        <p className="text-sm text-muted-foreground">No childcare added for this event.</p>
      )}
      {arrangements.map((arrangement) => (
        <div key={arrangement.id} className="space-y-3 rounded-md border bg-background/70 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Type">
              <Select value={arrangement.type} onValueChange={(value) => updateArrangement(arrangement.id, { type: value as ChildcareArrangement['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daycare">Kinderdagverblijf</SelectItem>
                  <SelectItem value="bso">BSO</SelectItem>
                  <SelectItem value="gastouder">Gastouder</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hours / month">
              <Input type="number" value={arrangement.hoursPerMonth || ''} onChange={(e) => updateArrangement(arrangement.id, { hoursPerMonth: parseFloat(e.target.value) || 0 })} />
            </Field>
            <Field label="Hourly rate">
              <CurrencyInput value={arrangement.hourlyRate} onChange={(value) => updateArrangement(arrangement.id, { hourlyRate: value })} />
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" size="icon" onClick={() => onChange(arrangements.filter((entry) => entry.id !== arrangement.id))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start month">
              <Input type="month" value={arrangement.startDate ?? ''} onChange={(e) => updateArrangement(arrangement.id, { startDate: e.target.value || undefined })} />
            </Field>
            <Field label="End month">
              <Input type="month" value={arrangement.endDate ?? ''} onChange={(e) => updateArrangement(arrangement.id, { endDate: e.target.value || undefined })} />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function MortgageEditor({
  mortgages,
  onChange,
}: {
  mortgages: MortgageConfig[];
  onChange: (mortgages: MortgageConfig[]) => void;
}) {
  const updateMortgage = (id: string, changes: Partial<MortgageConfig>) => {
    onChange(mortgages.map((mortgage) => (mortgage.id === id ? { ...mortgage, ...changes } : mortgage)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Mortgages</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onChange([
              ...mortgages,
              {
                id: uuidv4(),
                label: 'Mortgage',
                type: 'annuity',
                principal: 0,
                interestRate: 0.04,
                fixedRatePeriod: 10,
                variableRateAfter: 0.05,
                termYears: 30,
                startDate: '',
                deductibilityStartDate: '',
                extraRepayments: [],
                nhg: false,
              },
            ]);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Mortgage
        </Button>
      </div>
      {mortgages.map((mortgage) => (
        <div key={mortgage.id} className="space-y-3 rounded-md border bg-background/70 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Label">
              <Input value={mortgage.label} onChange={(e) => updateMortgage(mortgage.id, { label: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={mortgage.type} onValueChange={(value) => updateMortgage(mortgage.id, { type: value as MortgageConfig['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annuity">Annuity</SelectItem>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="interest-only">Interest only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Principal">
              <CurrencyInput value={mortgage.principal} onChange={(value) => updateMortgage(mortgage.id, { principal: value })} />
            </Field>
            <div className="flex items-end">
              <Button variant="ghost" size="icon" onClick={() => onChange(mortgages.filter((entry) => entry.id !== mortgage.id))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Rate">
              <PercentInput value={mortgage.interestRate} onChange={(value) => updateMortgage(mortgage.id, { interestRate: value })} />
            </Field>
            <Field label="Fixed years">
              <Input type="number" value={mortgage.fixedRatePeriod || ''} onChange={(e) => updateMortgage(mortgage.id, { fixedRatePeriod: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="Rate after fixed period">
              <PercentInput value={mortgage.variableRateAfter} onChange={(value) => updateMortgage(mortgage.id, { variableRateAfter: value })} />
            </Field>
            <Field label="Term years">
              <Input type="number" value={mortgage.termYears || ''} onChange={(e) => updateMortgage(mortgage.id, { termYears: parseInt(e.target.value) || 0 })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Start month">
              <Input type="month" value={mortgage.startDate ? mortgage.startDate.slice(0, 7) : ''} onChange={(e) => updateMortgage(mortgage.id, { startDate: e.target.value ? `${e.target.value}-01` : '' })} />
            </Field>
            <Field label="Deductibility start">
              <Input type="month" value={mortgage.deductibilityStartDate ? mortgage.deductibilityStartDate.slice(0, 7) : ''} onChange={(e) => updateMortgage(mortgage.id, { deductibilityStartDate: e.target.value ? `${e.target.value}-01` : '' })} />
            </Field>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">NHG discount</span>
              <Switch checked={mortgage.nhg} onCheckedChange={(checked) => updateMortgage(mortgage.id, { nhg: checked })} />
            </div>
          </div>
        </div>
      ))}
      {mortgages.length === 0 && (
        <p className="text-sm text-muted-foreground">No mortgages configured. The event will be treated as a cash purchase.</p>
      )}
    </div>
  );
}

export function LifeEventsModule() {
  const scenario = useActiveScenario();
  const updateLifeEvents = useStore((s) => s.updateLifeEvents);
  const events = normalizeLifeEvents(scenario.lifeEvents);

  const sortedEvents = [...events.filter((event) => eventTypeOrder.includes(event.type))].sort((a, b) => a.date.localeCompare(b.date));

  const addEvent = () => {
    updateLifeEvents(scenario.id, [...events, createDefaultLifeEvent('cash_windfall')]);
  };

  const updateEvent = (id: string, changes: Partial<LifeEvent>) => {
    updateLifeEvents(scenario.id, events.map((event) => (event.id === id ? { ...event, ...changes } : event)));
  };

  const replaceEventType = (id: string, type: LifeEventType) => {
    const existing = events.find((event) => event.id === id);
    const replacement = createDefaultLifeEvent(type);
    updateLifeEvents(
      scenario.id,
      events.map((event) => (
        event.id === id
          ? {
              ...replacement,
              id,
              date: existing?.date ?? '',
              label: existing?.label || replacement.label,
              description: existing?.description ?? '',
            }
          : event
      )),
    );
  };

  const removeEvent = (id: string) => {
    updateLifeEvents(scenario.id, events.filter((event) => event.id !== id));
  };

  const propertyOptions = [
    ...scenario.housing.properties.map((property) => ({ id: property.id, label: property.label || 'Property' })),
    ...events
      .filter((event) => event.type === 'buy_property' && event.propertyId)
      .map((event) => ({ id: event.propertyId!, label: event.propertyLabel || event.label || 'Purchased property' })),
  ].filter((option, index, all) => all.findIndex((entry) => entry.id === option.id) === index);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Life Events</h2>
          <p className="text-muted-foreground mt-1">Track one-off cash flows and partner status changes that do not belong to a dedicated planning module.</p>
        </div>
        <Button onClick={addEvent}>
          <Plus className="h-4 w-4 mr-2" /> Add Event
        </Button>
      </div>

      <ModuleHint id="events">
        Salary changes and career breaks now live in Income. Children and childcare planning live in Expenses through future birth dates. Property purchases and sales live in Housing through property start and end dates. Keep this page for windfalls, one-time expenses, and partner household changes.
      </ModuleHint>

      {sortedEvents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No life events planned</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Add one-off cash events or household partner changes.
            </p>
            <Button onClick={addEvent}>
              <Plus className="h-4 w-4 mr-2" /> Add Event
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sortedEvents.map((event) => {
          const config = eventTypeConfig[event.type] ?? eventTypeConfig.cash_windfall;
          const Icon = config.icon;

          return (
            <Card key={event.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-lg bg-muted ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Type">
                        <Select value={event.type} onValueChange={(value) => replaceEventType(event.id, value as LifeEventType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {eventTypeOrder.map((type) => (
                              <SelectItem key={type} value={type}>{eventTypeConfig[type].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Date">
                        <Input type="month" value={event.date} onChange={(e) => updateEvent(event.id, { date: e.target.value })} />
                      </Field>
                      <Field label="Label">
                        <Input value={event.label} onChange={(e) => updateEvent(event.id, { label: e.target.value })} placeholder="Short name for this event" />
                      </Field>
                    </div>

                    <p className="text-sm text-muted-foreground">{config.helper}</p>

                    {event.type === 'salary_change' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label="Target person">
                          <Select value={event.isPartner ? 'partner' : 'primary'} onValueChange={(value) => updateEvent(event.id, { isPartner: value === 'partner' })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primary</SelectItem>
                              <SelectItem value="partner">Partner</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Mode">
                          <Select value={event.salaryChangeMode ?? 'set'} onValueChange={(value) => updateEvent(event.id, { salaryChangeMode: value as LifeEvent['salaryChangeMode'] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="set">Set salary</SelectItem>
                              <SelectItem value="delta">Add delta</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label={event.salaryChangeMode === 'delta' ? 'Annual salary delta' : 'New annual salary'}>
                          <CurrencyInput
                            value={event.salaryChangeMode === 'delta' ? (event.annualSalaryDelta ?? 0) : (event.annualSalary ?? 0)}
                            onChange={(value) => updateEvent(event.id, event.salaryChangeMode === 'delta' ? { annualSalaryDelta: value } : { annualSalary: value })}
                          />
                        </Field>
                      </div>
                    )}

                    {event.type === 'career_break' && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <Field label="Target person">
                          <Select value={event.isPartner ? 'partner' : 'primary'} onValueChange={(value) => updateEvent(event.id, { isPartner: value === 'partner' })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primary</SelectItem>
                              <SelectItem value="partner">Partner</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Duration (months)">
                          <Input type="number" value={event.durationMonths || ''} onChange={(e) => updateEvent(event.id, { durationMonths: parseInt(e.target.value) || 0 })} />
                        </Field>
                        <Field label="Income replacement">
                          <PercentInput value={event.incomeReplacementRate ?? 0} onChange={(value) => updateEvent(event.id, { incomeReplacementRate: value })} />
                        </Field>
                        <Field label="Monthly expense change">
                          <CurrencyInput value={event.monthlyExpenseChange ?? 0} onChange={(value) => updateEvent(event.id, { monthlyExpenseChange: value })} />
                        </Field>
                      </div>
                    )}

                    {event.type === 'child_born' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Child name">
                            <Input value={event.childName ?? ''} onChange={(e) => updateEvent(event.id, { childName: e.target.value })} placeholder="Name" />
                          </Field>
                          <Field label="Base monthly child cost">
                            <CurrencyInput value={event.childMonthlyExpense ?? 500} onChange={(value) => updateEvent(event.id, { childMonthlyExpense: value })} />
                          </Field>
                        </div>
                        <ChildcareArrangementEditor
                          arrangements={event.childCareArrangements ?? []}
                          onChange={(arrangements) => updateEvent(event.id, { childCareArrangements: arrangements })}
                        />
                      </div>
                    )}

                    {event.type === 'partner_change' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">Partner active</p>
                            <p className="text-xs text-muted-foreground">Use the partner salary already configured in Income.</p>
                          </div>
                          <Switch checked={event.partnerActive ?? true} onCheckedChange={(checked) => updateEvent(event.id, { partnerActive: checked })} />
                        </div>
                        <Field label="Monthly household expense change">
                          <CurrencyInput value={event.monthlyExpenseChange ?? 0} onChange={(value) => updateEvent(event.id, { monthlyExpenseChange: value })} />
                        </Field>
                      </div>
                    )}

                    {(event.type === 'cash_windfall' || event.type === 'one_time_expense') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={event.type === 'cash_windfall' ? 'Cash amount' : 'Expense amount'}>
                          <CurrencyInput value={event.cashAmount ?? 0} onChange={(value) => updateEvent(event.id, { cashAmount: value })} />
                        </Field>
                      </div>
                    )}

                    {event.type === 'buy_property' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field label="Property label">
                            <Input value={event.propertyLabel ?? ''} onChange={(e) => updateEvent(event.id, { propertyLabel: e.target.value })} />
                          </Field>
                          <Field label="Purchase price">
                            <CurrencyInput value={event.propertyValue ?? 0} onChange={(value) => updateEvent(event.id, { propertyValue: value })} />
                          </Field>
                          <Field label="WOZ value">
                            <CurrencyInput value={event.propertyWozValue ?? 0} onChange={(value) => updateEvent(event.id, { propertyWozValue: value })} />
                          </Field>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field label="Appreciation rate">
                            <PercentInput value={event.propertyAppreciationRate ?? 0.03} onChange={(value) => updateEvent(event.id, { propertyAppreciationRate: value })} />
                          </Field>
                          <Field label="Monthly rent">
                            <CurrencyInput value={event.propertyRentalIncome ?? 0} onChange={(value) => updateEvent(event.id, { propertyRentalIncome: value })} />
                          </Field>
                          <Field label="Purchase costs">
                            <CurrencyInput value={event.propertyPurchaseCosts ?? 0} onChange={(value) => updateEvent(event.id, { propertyPurchaseCosts: value })} />
                          </Field>
                        </div>
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">Owner occupied</p>
                            <p className="text-xs text-muted-foreground">Turn off for rental property events.</p>
                          </div>
                          <Switch checked={event.propertyOwnerOccupied ?? true} onCheckedChange={(checked) => updateEvent(event.id, { propertyOwnerOccupied: checked })} />
                        </div>
                        <MortgageEditor mortgages={event.propertyMortgages ?? []} onChange={(mortgages) => updateEvent(event.id, { propertyMortgages: mortgages })} />
                      </div>
                    )}

                    {event.type === 'sell_property' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label="Property to sell">
                          <Select value={event.propertyId ?? ''} onValueChange={(value) => updateEvent(event.id, { propertyId: value })}>
                            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                            <SelectContent>
                              {propertyOptions.map((property) => (
                                <SelectItem key={property.id} value={property.id}>{property.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Sale price">
                          <CurrencyInput value={event.salePrice ?? 0} onChange={(value) => updateEvent(event.id, { salePrice: value })} />
                        </Field>
                        <Field label="Selling costs">
                          <CurrencyInput value={event.sellingCosts ?? 0} onChange={(value) => updateEvent(event.id, { sellingCosts: value })} />
                        </Field>
                      </div>
                    )}

                    <Field label="Description" className="w-full">
                      <Input value={event.description ?? ''} onChange={(e) => updateEvent(event.id, { description: e.target.value })} placeholder="Optional notes or details..." />
                    </Field>
                  </div>

                  <Button variant="ghost" size="icon" className="mt-6 shrink-0" onClick={() => removeEvent(event.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
