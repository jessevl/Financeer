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
import { Plus, Trash2, TrendingUp, PiggyBank, Landmark, Building2 } from 'lucide-react';
import type { InvestmentConfig, InvestmentAccount } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/format';
import { createInvestmentAccount } from '@/data/defaults';

export function InvestmentsModule() {
  const scenario = useActiveScenario();
  const updateInvestments = useStore((s) => s.updateInvestments);
  const inv = scenario.investments;
  const currentYear = new Date().getFullYear();

  const update = (changes: Partial<InvestmentConfig>) => {
    updateInvestments(scenario.id, { ...inv, ...changes });
  };

  const addAccount = () => {
    const newAcc: InvestmentAccount = createInvestmentAccount('brokerage', {
      name: 'New Account',
      monthlyContribution: 0,
    });
    update({ accounts: [...inv.accounts, newAcc] });
  };

  const updateAccount = (id: string, changes: Partial<InvestmentAccount>) => {
    update({ accounts: inv.accounts.map((a) => a.id === id ? { ...a, ...changes } : a) });
  };

  const removeAccount = (id: string) => {
    update({ accounts: inv.accounts.filter((a) => a.id !== id) });
  };

  const updateAccountType = (id: string, type: InvestmentAccount['type']) => {
    const currentAccount = inv.accounts.find((account) => account.id === id);
    if (!currentAccount) return;

    if (type === 'savings') {
      updateAccount(id, {
        type,
        expectedReturn: currentAccount.expectedReturn > 0 ? currentAccount.expectedReturn : 0.02,
        volatility: 0,
        expenseRatio: 0,
        reinvestDividends: false,
        payoutPhase: 'accumulation',
        payoutStartYear: undefined,
        payoutDurationYears: undefined,
        partnerContinuation: false,
      });
      return;
    }

    const isTaxAdvantagedAccount = type === 'lijfrente';
    updateAccount(id, {
      type,
      volatility: currentAccount.volatility > 0 ? currentAccount.volatility : 0.15,
      expenseRatio: currentAccount.expenseRatio > 0 ? currentAccount.expenseRatio : 0.002,
      reinvestDividends: currentAccount.reinvestDividends ?? true,
      payoutPhase: isTaxAdvantagedAccount ? (currentAccount.payoutPhase ?? 'accumulation') : 'accumulation',
      payoutStartYear: isTaxAdvantagedAccount ? (currentAccount.payoutStartYear ?? currentYear) : undefined,
      payoutDurationYears: isTaxAdvantagedAccount ? (currentAccount.payoutDurationYears ?? 20) : undefined,
      partnerContinuation: isTaxAdvantagedAccount ? (currentAccount.partnerContinuation ?? false) : false,
    });
  };

  const totalMonthly = inv.accounts.reduce((s, a) => s + a.monthlyContribution, 0);
  const totalBalance = inv.accounts.reduce((s, a) => s + a.balance, 0);
  const savingsAccountCount = inv.accounts.filter((account) => account.type === 'savings').length;
  const sweepEligibleAccounts = inv.accounts.filter((account) => account.type !== 'lijfrente');
  const resolvedSweepAccountId = sweepEligibleAccounts.some((account) => account.id === inv.autoSweepAccountId)
    ? inv.autoSweepAccountId
    : sweepEligibleAccounts[0]?.id;

  const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    brokerage: TrendingUp,
    'real-estate': Building2,
    savings: PiggyBank,
    lijfrente: Landmark,
  };

  const typeLabels: Record<InvestmentAccount['type'], string> = {
    brokerage: 'brokerage',
    'real-estate': 'real estate',
    savings: 'savings',
    lijfrente: 'lijfrente',
  };

  return (
    <ModuleLayout sidebar={<InvestmentsCalcSidebar />}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Savings & Investments</h2>
        <p className="text-muted-foreground mt-1">Your savings and investment portfolio.</p>
      </div>

      <ModuleHint id="investments">
        Add the accounts you actually use: savings accounts, brokerage portfolios, brokered real-estate investments, and lijfrente. Savings now live in a savings account as well, so every liquid balance can earn its own interest rate in the simulation.
      </ModuleHint>

      {/* Emergency Fund */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Emergency Fund
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Emergency Fund Target" tooltip="Amount to keep available in savings accounts before drawing down investments." className="max-w-xs">
            <CurrencyInput value={inv.emergencyFund} onChange={(v) => update({ emergencyFund: v })} />
          </Field>
          {sweepEligibleAccounts.length > 0 ? (
            <>
              <div className="mt-4 max-w-sm">
                <Field label="Sweep Surplus To" tooltip="After the emergency fund is filled, leftover monthly cash is automatically routed into this account.">
                  <Select value={resolvedSweepAccountId} onValueChange={(value) => update({ autoSweepAccountId: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sweepEligibleAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Monthly surplus first tops up savings until the emergency fund target is reached, then any remaining cash is swept into the selected account.
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Add a savings, brokerage, or brokered real-estate account if you want surplus cash to be routed automatically after the emergency fund is full.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {inv.accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">Total Balance</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
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
        const isSavingsAccount = acc.type === 'savings';
        const isTaxAdvantagedAccount = acc.type === 'lijfrente';
        const isOnlySavingsAccount = isSavingsAccount && savingsAccountCount === 1;
        const payoutPhase = acc.payoutPhase ?? 'accumulation';
        return (
          <Card key={acc.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {acc.name}
                  <Badge variant="secondary" className="ml-2 text-xs capitalize">{typeLabels[acc.type]}</Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAccount(acc.id)}
                  className="text-destructive"
                  disabled={isOnlySavingsAccount}
                  title={isOnlySavingsAccount ? 'At least one savings account is required for cash flow and the emergency fund.' : undefined}
                >
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
                  <Select value={acc.type} onValueChange={(value) => updateAccountType(acc.id, value as InvestmentAccount['type'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brokerage">Brokerage / ETF</SelectItem>
                      <SelectItem value="real-estate">Real estate via broker / fund</SelectItem>
                      <SelectItem value="savings">Savings account</SelectItem>
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

              <div className={`grid grid-cols-2 ${isSavingsAccount ? 'sm:grid-cols-2' : 'sm:grid-cols-4'} gap-4`}>
                <Field label={isSavingsAccount ? 'Interest Rate' : 'Expected Return'} tooltip={isSavingsAccount ? 'Annual savings interest rate.' : 'Annual expected return (e.g. 7% for global index fund)'}>
                  <PercentInput value={acc.expectedReturn} onChange={(v) => updateAccount(acc.id, { expectedReturn: v })} />
                </Field>
                {!isSavingsAccount && (
                  <Field label="Volatility (σ)" tooltip="Annual standard deviation of returns for Monte Carlo simulation (e.g. 15% for equities)">
                    <PercentInput value={acc.volatility ?? 0.15} onChange={(v) => updateAccount(acc.id, { volatility: v })} />
                  </Field>
                )}
                {!isSavingsAccount && (
                  <Field label="Expense Ratio (TER)" tooltip="Annual fees charged by the fund/platform">
                    <PercentInput value={acc.expenseRatio} onChange={(v) => updateAccount(acc.id, { expenseRatio: v })} />
                  </Field>
                )}
                <Field label={isSavingsAccount ? 'Net Interest' : 'Net Return'}>
                  <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                    {formatPercent(acc.expectedReturn - acc.expenseRatio)}
                  </div>
                </Field>
              </div>

              <div className="flex items-center gap-6">
                {!isSavingsAccount && (
                  <div className="flex items-center gap-2">
                    <Switch checked={acc.reinvestDividends} onCheckedChange={(v) => updateAccount(acc.id, { reinvestDividends: v })} />
                    <Label className="text-sm">Reinvest dividends</Label>
                  </div>
                )}
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

              {isTaxAdvantagedAccount && (
                <div className="space-y-4 rounded-lg border border-dashed p-4">
                  <div>
                    <p className="text-sm font-medium">Payout schedule</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lijfrente pots stay outside the generic withdrawal order. Use the schedule below to model when they turn into taxable retirement income.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Payout Type">
                      <Select
                        value={payoutPhase}
                        onValueChange={(value) => {
                          const nextPhase = value as 'accumulation' | 'fixed-term' | 'lifetime';
                          updateAccount(acc.id, {
                            payoutPhase: nextPhase,
                            payoutStartYear: nextPhase === 'accumulation' ? acc.payoutStartYear : (acc.payoutStartYear ?? currentYear),
                            payoutDurationYears: nextPhase === 'fixed-term' ? (acc.payoutDurationYears ?? 20) : undefined,
                            partnerContinuation: nextPhase === 'accumulation' ? false : (acc.partnerContinuation ?? false),
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accumulation">Still accumulating</SelectItem>
                          <SelectItem value="fixed-term">Fixed term</SelectItem>
                          <SelectItem value="lifetime">Lifetime until death</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    {payoutPhase !== 'accumulation' && (
                      <Field label="Start Year">
                        <Input
                          type="number"
                          value={acc.payoutStartYear ?? currentYear}
                          onChange={(e) => updateAccount(acc.id, { payoutStartYear: parseInt(e.target.value, 10) || currentYear })}
                        />
                      </Field>
                    )}
                  </div>

                  {payoutPhase === 'fixed-term' && (
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Duration (years)">
                        <Input
                          type="number"
                          min="1"
                          value={acc.payoutDurationYears ?? 20}
                          onChange={(e) => updateAccount(acc.id, { payoutDurationYears: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        />
                      </Field>
                    </div>
                  )}

                  {payoutPhase !== 'accumulation' && (
                    <div className="flex items-start gap-3">
                      <Switch
                        checked={acc.partnerContinuation ?? false}
                        onCheckedChange={(checked) => updateAccount(acc.id, { partnerContinuation: checked })}
                      />
                      <div>
                        <Label className="text-sm">Partner continuation</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          For lifetime payouts, Financeer extends the payout horizon to the later assumed death date when partner continuation is enabled, which lowers the monthly payout estimate.
                        </p>
                      </div>
                    </div>
                  )}

                  {payoutPhase === 'lifetime' && (
                    <p className="text-xs text-muted-foreground">
                      Lifetime payouts are estimated as a level annuity until the assumed death date in Personal settings, or until the later partner death date when partner continuation is enabled.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button variant="outline" className="w-full" onClick={addAccount}>
        <Plus className="h-4 w-4 mr-2" /> Add Savings or Investment Account
      </Button>
    </ModuleLayout>
  );
}
