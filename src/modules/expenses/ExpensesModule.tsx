import { useStore, useActiveScenario, useSettings } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { ExpensesCalcSidebar } from './ExpensesCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { Plus, Trash2, ShoppingCart, CreditCard, CalendarDays, Baby, Heart, Sparkles, Scale, TrendingUp, PieChart } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useSimulation } from '@/hooks/useSimulation';
import { formatCurrency } from '@/lib/format';
import type { ExpenseConfig, ExpenseItem, ChildConfig, ChildcareArrangement } from '@/types';
import { summarizeExpenses } from './expenseSummary';
import { getMortgageSnapshotAtDate } from '@/engine/mortgage';
import { getChildcareArrangements } from '@/lib/childcare';

function ExpenseList({
  items,
  onUpdate,
  onRemove,
  onAdd,
  title,
  description,
  icon: Icon,
}: {
  items: ExpenseItem[];
  onUpdate: (id: string, changes: Partial<ExpenseItem>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Input
              value={item.label}
              onChange={(e) => onUpdate(item.id, { label: e.target.value })}
              placeholder="Label"
              className="flex-1 min-w-[120px]"
            />
            <Input
              value={item.category}
              onChange={(e) => onUpdate(item.id, { category: e.target.value })}
              placeholder="Category"
              className="w-28 sm:w-32"
            />
            <div className="w-28 sm:w-32">
              <CurrencyInput value={item.amount} onChange={(v) => onUpdate(item.id, { amount: v })} />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onRemove(item.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No items added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ExpensesModule() {
  const scenario = useActiveScenario();
  const settings = useSettings();
  const updateExpenses = useStore((s) => s.updateExpenses);
  const sim = useSimulation();
  const exp = scenario.expenses;
  const isCoupleHousehold = scenario.tax.filingType === 'couple';

  const update = (changes: Partial<ExpenseConfig>) => {
    updateExpenses(scenario.id, { ...exp, ...changes });
  };

  // Budget reconciliation
  const currentYear = new Date().getFullYear();
  const yearSummary = sim.annualSummaries.find((s) => s.year === currentYear);
  const monthlyNetIncome = yearSummary ? yearSummary.netIncome / 12 : 0;
  const monthlyToeslagen = yearSummary ? yearSummary.totalToeslagen / 12 : 0;
  const monthlyMortgage = scenario.housing.properties.reduce(
    (sum, property) => sum + property.mortgages.reduce((mortgageSum, mortgage) => {
      const snapshot = getMortgageSnapshotAtDate(mortgage);
      return mortgageSum + (snapshot.hasStarted && !snapshot.isPaidOff ? snapshot.currentPayment : 0);
    }, 0),
    0,
  );
  const monthlyInvestments = yearSummary ? yearSummary.totalInvestmentContributions / 12 : 0;
  const expenseSummary = summarizeExpenses(exp, isCoupleHousehold);
  const monthlyExpenses = expenseSummary.totalMonthly;
  const monthlyUnaccounted = monthlyNetIncome + monthlyToeslagen - monthlyExpenses - monthlyMortgage - monthlyInvestments;

  const updateChild = (childId: string, changes: Partial<ChildConfig>) => {
    update({ children: exp.children.map((child) => (child.id === childId ? { ...child, ...changes } : child)) });
  };

  const writeChildcareArrangements = (child: ChildConfig, arrangements: ChildcareArrangement[]): ChildConfig => ({
    ...child,
    childcareArrangements: arrangements,
    kinderopvangType: 'none',
    kinderopvangHoursPerMonth: 0,
    kinderopvangHourlyRate: 0,
    kinderopvangStartDate: undefined,
    kinderopvangEndDate: undefined,
  });

  const updateChildArrangements = (
    childId: string,
    updater: (arrangements: ChildcareArrangement[]) => ChildcareArrangement[],
  ) => {
    update({
      children: exp.children.map((child) => (
        child.id === childId
          ? writeChildcareArrangements(child, updater(getChildcareArrangements(child)))
          : child
      )),
    });
  };

  const makeListHandlers = (field: 'monthlyFixed' | 'monthlyVariable' | 'annualExpenses') => ({
    items: exp[field],
    onUpdate: (id: string, changes: Partial<ExpenseItem>) => {
      update({ [field]: exp[field].map((i) => i.id === id ? { ...i, ...changes } : i) });
    },
    onRemove: (id: string) => {
      update({ [field]: exp[field].filter((i) => i.id !== id) });
    },
    onAdd: () => {
      update({ [field]: [...exp[field], { id: uuidv4(), label: '', amount: 0, category: '' }] });
    },
  });

  const categoryTotals = expenseSummary.categoryRows;
  const totalMonthlyExpenses = expenseSummary.totalMonthly;

  return (
    <ModuleLayout sidebar={<ExpensesCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Expenses</h2>
        <p className="text-muted-foreground mt-1">Track your monthly and annual spending.</p>
      </div>

      <ModuleHint id="expenses">
        Break down your expenses into fixed monthly costs (rent, subscriptions), variable spending (groceries, clothing), and annual costs (insurance, holidays). Plan children here by setting birth dates, including future birth dates, plus childcare start and end months. The budget reconciliation shows how your net income is allocated. Mortgage and investment contributions are included automatically.
      </ModuleHint>

      {/* Budget Reconciliation */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Monthly Budget Reconciliation
          </CardTitle>
          <CardDescription>How your net income is allocated each month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net income (after tax)</span>
              <span className="font-medium">{formatCurrency(monthlyNetIncome)}</span>
            </div>
            {monthlyToeslagen > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ Toeslagen</span>
                <span className="font-medium text-green-600">+{formatCurrency(monthlyToeslagen)}</span>
              </div>
            )}
            <div className="border-t my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">– Declared expenses</span>
              <span className="font-medium">-{formatCurrency(monthlyExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">– Mortgage payments</span>
              <span className="font-medium">-{formatCurrency(monthlyMortgage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">– Investment contributions</span>
              <span className="font-medium">-{formatCurrency(monthlyInvestments)}</span>
            </div>
            <div className="border-t my-2" />
            <div className="flex justify-between font-semibold">
              <span>{monthlyUnaccounted >= 0 ? 'Unaccounted surplus' : 'Budget shortfall'}</span>
              <span className={monthlyUnaccounted >= 0 ? 'text-amber-600' : 'text-red-600'}>
                {formatCurrency(monthlyUnaccounted)}/mo
              </span>
            </div>
          </div>
          {Math.abs(monthlyUnaccounted) > 50 && (
            <p className="text-xs text-muted-foreground mt-3">
              {monthlyUnaccounted > 0
                ? 'This surplus accumulates as cash savings each month. Consider adding it to your declared expenses or investment contributions for a more accurate projection.'
                : 'Your declared expenses exceed your income. The shortfall is covered from cash savings. Check your numbers or reduce expenses.'}
            </p>
          )}
        </CardContent>
      </Card>

      <ExpenseList
        {...makeListHandlers('monthlyFixed')}
        title="Monthly Fixed Expenses"
        description="Rent, utilities, insurance, subscriptions"
        icon={CreditCard}
      />

      <ExpenseList
        {...makeListHandlers('monthlyVariable')}
        title="Monthly Variable Expenses"
        description="Groceries, transport, entertainment"
        icon={ShoppingCart}
      />

      <ExpenseList
        {...makeListHandlers('annualExpenses')}
        title="Annual Expenses"
        description="Holidays, maintenance, gifts"
        icon={CalendarDays}
      />

      {/* Category Summary + Mortgage */}
      {(categoryTotals.length > 0 || monthlyMortgage > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Monthly Outflows Breakdown
            </CardTitle>
            <CardDescription>Everything that leaves your bank account each month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const grandTotal = totalMonthlyExpenses + monthlyMortgage + monthlyInvestments;
                const rows = [
                  ...categoryTotals.map((c) => ({ label: c.label, amount: c.amount })),
                  ...(monthlyMortgage > 0 ? [{ label: 'Mortgage payment', amount: monthlyMortgage }] : []),
                  ...(monthlyInvestments > 0 ? [{ label: 'Investment contributions', amount: monthlyInvestments }] : []),
                ].sort((a, b) => b.amount - a.amount);

                return (
                  <>
                    {rows.map(({ label, amount }) => {
                      const pct = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
                      const isMortgage = label === 'Mortgage payment';
                      const isInvestment = label === 'Investment contributions';
                      return (
                        <div key={label} className="flex items-center gap-2 sm:gap-3">
                          <span className={`text-xs sm:text-sm w-24 sm:w-32 truncate ${
                            isMortgage ? 'text-amber-600 dark:text-amber-400 font-medium' :
                            isInvestment ? 'text-blue-600 dark:text-blue-400 font-medium' :
                            'text-muted-foreground'
                          }`}>{label}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isMortgage ? 'bg-amber-500' :
                                isInvestment ? 'bg-blue-500' :
                                'bg-[var(--color-accent-primary)]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm font-medium w-20 sm:w-24 text-right">{formatCurrency(amount)}/mo</span>
                          <span className="text-xs text-muted-foreground w-10 sm:w-12 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                    <div className="border-t pt-2 mt-1 flex justify-between font-semibold text-sm">
                      <span>Total outflows</span>
                      <span>{formatCurrency(grandTotal)}/mo · {formatCurrency(grandTotal * 12)}/yr</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Healthcare */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Healthcare
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly Premium" tooltip="Zorgverzekering monthly premium">
              <CurrencyInput value={exp.healthcareMonthlyPremium} onChange={(v) => update({ healthcareMonthlyPremium: v })} />
            </Field>
            <Field label="Annual Deductible" tooltip="Eigen risico — your annual healthcare deductible (€385 in 2025)">
              <CurrencyInput value={exp.healthcareDeductible} onChange={(v) => update({ healthcareDeductible: v })} />
            </Field>
          </div>
          {isCoupleHousehold && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Partner Monthly Premium" tooltip="Partner's zorgverzekering monthly premium">
                <CurrencyInput value={exp.partnerHealthcareMonthlyPremium} onChange={(v) => update({ partnerHealthcareMonthlyPremium: v })} />
              </Field>
              <Field label="Partner Annual Deductible" tooltip="Partner's eigen risico">
                <CurrencyInput value={exp.partnerHealthcareDeductible} onChange={(v) => update({ partnerHealthcareDeductible: v })} />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inflation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Inflation
          </CardTitle>
          <CardDescription>Override the global inflation rate ({(settings.inflationRate * 100).toFixed(1)}%) for expense projections in this scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Custom Inflation Rate" tooltip="Leave empty to use the global rate from Settings. This rate is used to grow all expenses and the FIRE target over time." className="max-w-xs">
            <PercentInput
              value={exp.customInflationRate ?? settings.inflationRate}
              onChange={(v) => update({ customInflationRate: v === settings.inflationRate ? undefined : v })}
            />
          </Field>
          {exp.customInflationRate != null && exp.customInflationRate !== settings.inflationRate && (
            <p className="text-xs text-muted-foreground mt-2">
              Using custom rate of {(exp.customInflationRate * 100).toFixed(1)}% instead of the global {(settings.inflationRate * 100).toFixed(1)}%.{' '}
              <button className="underline" onClick={() => update({ customInflationRate: undefined })}>Reset to global</button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Children */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5" />
              Children
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => {
              update({ children: [...exp.children, { id: uuidv4(), name: '', birthDate: '', monthlyExpense: 350, childcareArrangements: [], kinderopvangType: 'none', kinderopvangHoursPerMonth: 0, kinderopvangHourlyRate: 0 }] });
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Child
            </Button>
          </div>
          <CardDescription>Costs automatically adjust by age: 100% (0-4), 120% (4-12), 150% (12-18), 80% (18-23). Future birth dates work, so you can plan children directly here.</CardDescription>
        </CardHeader>
        {exp.children.length > 0 && (
          <CardContent className="space-y-3">
            {exp.children.map((child) => {
              const childcareArrangements = getChildcareArrangements(child);

              return (
                <div key={child.id} className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                    <Field label="Name" className="flex-1 min-w-[120px]">
                      <Input value={child.name} onChange={(e) => {
                        updateChild(child.id, { name: e.target.value });
                      }} placeholder="Name" />
                    </Field>
                    <Field label="Birth Date" className="w-36 sm:w-40">
                      <Input type="date" value={child.birthDate} onChange={(e) => {
                        updateChild(child.id, { birthDate: e.target.value });
                      }} />
                    </Field>
                    <Field label="Monthly Cost (base)" className="w-32 sm:w-36">
                      <CurrencyInput value={child.monthlyExpense} onChange={(v) => {
                        updateChild(child.id, { monthlyExpense: v });
                      }} />
                    </Field>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                      update({ children: exp.children.filter((c) => c.id !== child.id) });
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Childcare arrangements</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateChildArrangements(child.id, (arrangements) => [
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
                    {childcareArrangements.length === 0 && (
                      <p className="text-sm text-muted-foreground">No childcare added for this child.</p>
                    )}
                    {childcareArrangements.map((arrangement) => (
                      <div key={arrangement.id} className="space-y-3 rounded-md border bg-background/70 p-3">
                        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                          <Field label="Type" className="w-40 sm:w-44">
                            <Select
                              value={arrangement.type}
                              onValueChange={(value) => {
                                updateChildArrangements(child.id, (arrangements) => arrangements.map((entry) => (
                                  entry.id === arrangement.id ? { ...entry, type: value as ChildcareArrangement['type'] } : entry
                                )));
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daycare">Kinderdagverblijf</SelectItem>
                                <SelectItem value="bso">BSO (After-school)</SelectItem>
                                <SelectItem value="gastouder">Gastouder</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Hours/month" className="w-28">
                            <Input
                              type="number"
                              value={arrangement.hoursPerMonth || ''}
                              onChange={(e) => {
                                updateChildArrangements(child.id, (arrangements) => arrangements.map((entry) => (
                                  entry.id === arrangement.id ? { ...entry, hoursPerMonth: parseFloat(e.target.value) || 0 } : entry
                                )));
                              }}
                            />
                          </Field>
                          <Field label="Hourly rate" className="w-28">
                            <CurrencyInput
                              value={arrangement.hourlyRate}
                              onChange={(value) => {
                                updateChildArrangements(child.id, (arrangements) => arrangements.map((entry) => (
                                  entry.id === arrangement.id ? { ...entry, hourlyRate: value } : entry
                                )));
                              }}
                            />
                          </Field>
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                            updateChildArrangements(child.id, (arrangements) => arrangements.filter((entry) => entry.id !== arrangement.id));
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                          <Field label="Start month" tooltip="First month of childcare (leave empty for birth date)" className="w-36 sm:w-40">
                            <Input
                              type="month"
                              value={arrangement.startDate ?? ''}
                              onChange={(e) => {
                                updateChildArrangements(child.id, (arrangements) => arrangements.map((entry) => (
                                  entry.id === arrangement.id ? { ...entry, startDate: e.target.value || undefined } : entry
                                )));
                              }}
                            />
                          </Field>
                          <Field label="End month" tooltip="Last month of childcare (leave empty for age-limit)" className="w-36 sm:w-40">
                            <Input
                              type="month"
                              value={arrangement.endDate ?? ''}
                              onChange={(e) => {
                                updateChildArrangements(child.id, (arrangements) => arrangements.map((entry) => (
                                  entry.id === arrangement.id ? { ...entry, endDate: e.target.value || undefined } : entry
                                )));
                              }}
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* One-off Expenses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              One-off Expenses
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => {
              update({ oneOffExpenses: [...exp.oneOffExpenses, { id: uuidv4(), label: '', amount: 0, date: '' }] });
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Large one-time expenses (car, renovation, wedding)</CardDescription>
        </CardHeader>
        {exp.oneOffExpenses.length > 0 && (
          <CardContent className="space-y-3">
            {exp.oneOffExpenses.map((e) => (
              <div key={e.id} className="flex flex-wrap items-end gap-2 sm:gap-3 p-3 rounded-lg bg-muted/50">
                <Field label="Label" className="flex-1 min-w-[120px]">
                  <Input value={e.label} onChange={(ev) => {
                    update({ oneOffExpenses: exp.oneOffExpenses.map((x) => x.id === e.id ? { ...x, label: ev.target.value } : x) });
                  }} placeholder="e.g. New car" />
                </Field>
                <Field label="Date" className="w-36 sm:w-40">
                  <Input type="month" value={e.date} onChange={(ev) => {
                    update({ oneOffExpenses: exp.oneOffExpenses.map((x) => x.id === e.id ? { ...x, date: ev.target.value } : x) });
                  }} />
                </Field>
                <Field label="Amount" className="w-32 sm:w-36">
                  <CurrencyInput value={e.amount} onChange={(v) => {
                    update({ oneOffExpenses: exp.oneOffExpenses.map((x) => x.id === e.id ? { ...x, amount: v } : x) });
                  }} />
                </Field>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                  update({ oneOffExpenses: exp.oneOffExpenses.filter((x) => x.id !== e.id) });
                }}>
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
