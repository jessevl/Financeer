import { useStore, useActiveScenario } from '@/store';
import { ModuleLayout } from '@/components/common/ModuleLayout';
import { ModuleHint } from '@/components/common/ModuleHint';
import { InvestmentsCalcSidebar } from './InvestmentsCalcSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { Plus, Trash2, TrendingUp, PiggyBank, Landmark } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { InvestmentConfig, InvestmentAccount } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/format';

export function InvestmentsModule() {
  const scenario = useActiveScenario();
  const updateInvestments = useStore((s) => s.updateInvestments);
  const inv = scenario.investments;

  const update = (changes: Partial<InvestmentConfig>) => {
    updateInvestments(scenario.id, { ...inv, ...changes });
  };

  const addAccount = () => {
    const newAcc: InvestmentAccount = {
      id: uuidv4(),
      name: 'New Account',
      type: 'brokerage',
      balance: 0,
      monthlyContribution: 0,
      expectedReturn: 0.07,
      volatility: 0.15,
      expenseRatio: 0.002,
      compoundingFrequency: 'monthly',
      reinvestDividends: true,
    };
    update({ accounts: [...inv.accounts, newAcc] });
  };

  const updateAccount = (id: string, changes: Partial<InvestmentAccount>) => {
    update({ accounts: inv.accounts.map((a) => a.id === id ? { ...a, ...changes } : a) });
  };

  const removeAccount = (id: string) => {
    update({ accounts: inv.accounts.filter((a) => a.id !== id) });
  };

  const totalMonthly = inv.accounts.reduce((s, a) => s + a.monthlyContribution, 0);
  const totalBalance = inv.accounts.reduce((s, a) => s + a.balance, 0);

  const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    brokerage: TrendingUp,
    savings: PiggyBank,
    pension: Landmark,
    lijfrente: Landmark,
  };

  return (
    <ModuleLayout sidebar={<InvestmentsCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Savings & Investments</h2>
        <p className="text-muted-foreground mt-1">Your savings and investment portfolio.</p>
      </div>

      <ModuleHint id="investments">
        Set your current cash position and add investment accounts (brokerage, pension, crypto). Specify contribution amounts and expected returns — the simulation uses these to project your net worth over time, including Box 3 taxation on your assets.
      </ModuleHint>

      {/* Cash Savings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Cash Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Current Savings" tooltip="Total cash savings across all bank accounts">
              <CurrencyInput value={inv.currentSavings} onChange={(v) => update({ currentSavings: v })} />
            </Field>
            <Field label="Emergency Fund" tooltip="Amount to keep as emergency fund (won't be invested)">
              <CurrencyInput value={inv.emergencyFund} onChange={(v) => update({ emergencyFund: v })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {inv.accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Total Balance</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalBalance + inv.currentSavings)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Monthly Investing</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalMonthly)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Accounts</p>
              <p className="text-xl font-bold mt-1">{inv.accounts.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Investment Accounts */}
      {inv.accounts.map((acc) => {
        const Icon = typeIcons[acc.type] || TrendingUp;
        return (
          <Card key={acc.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {acc.name}
                  <Badge variant="secondary" className="ml-2 text-xs capitalize">{acc.type}</Badge>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => removeAccount(acc.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account Name">
                  <Input value={acc.name} onChange={(e) => updateAccount(acc.id, { name: e.target.value })} />
                </Field>
                <Field label="Account Type">
                  <Select value={acc.type} onValueChange={(v) => updateAccount(acc.id, { type: v as InvestmentAccount['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brokerage">Brokerage</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="pension">Pension</SelectItem>
                      <SelectItem value="lijfrente">Lijfrente</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Current Balance">
                  <CurrencyInput value={acc.balance} onChange={(v) => updateAccount(acc.id, { balance: v })} />
                </Field>
                <Field label="Monthly Contribution">
                  <CurrencyInput value={acc.monthlyContribution} onChange={(v) => updateAccount(acc.id, { monthlyContribution: v })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Expected Return" tooltip="Annual expected return (e.g. 7% for global index fund)">
                  <PercentInput value={acc.expectedReturn} onChange={(v) => updateAccount(acc.id, { expectedReturn: v })} />
                </Field>
                <Field label="Volatility (σ)" tooltip="Annual standard deviation of returns for Monte Carlo simulation (e.g. 15% for equities)">
                  <PercentInput value={acc.volatility ?? 0.15} onChange={(v) => updateAccount(acc.id, { volatility: v })} />
                </Field>
                <Field label="Expense Ratio (TER)" tooltip="Annual fees charged by the fund/platform">
                  <PercentInput value={acc.expenseRatio} onChange={(v) => updateAccount(acc.id, { expenseRatio: v })} />
                </Field>
                <Field label="Net Return">
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                    {formatPercent(acc.expectedReturn - acc.expenseRatio)}
                  </div>
                </Field>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={acc.reinvestDividends} onCheckedChange={(v) => updateAccount(acc.id, { reinvestDividends: v })} />
                  <Label className="text-sm">Reinvest dividends</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Compounding:</Label>
                  <Select value={acc.compoundingFrequency} onValueChange={(v) => updateAccount(acc.id, { compoundingFrequency: v as 'monthly' | 'annual' })}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button variant="outline" className="w-full" onClick={addAccount}>
        <Plus className="h-4 w-4 mr-2" /> Add Investment Account
      </Button>
    </ModuleLayout>
  );
}
