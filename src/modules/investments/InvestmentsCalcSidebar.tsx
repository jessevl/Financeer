import { useActiveScenario } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct, num } from '@/components/common/CalculationPanel';

export function InvestmentsCalcSidebar() {
  const scenario = useActiveScenario();
  const sim = useSimulation();
  const { investments: inv } = scenario;

  const savingsAccounts = inv.accounts.filter((account) => account.type === 'savings');
  const sweepTarget = inv.accounts.find((account) => account.id === inv.autoSweepAccountId)
    ?? inv.accounts.find((account) => account.type !== 'lijfrente');
  const totalBalance = inv.accounts.reduce((s, a) => s + a.balance, 0);
  const totalMonthly = inv.accounts.reduce((s, a) => s + a.monthlyContribution, 0);

  // Weighted average return & TER
  const weightedReturn = totalBalance > 0
    ? inv.accounts.reduce((s, a) => s + a.balance * a.expectedReturn, 0) / totalBalance
    : inv.accounts.length > 0
      ? inv.accounts.reduce((s, a) => s + a.expectedReturn, 0) / inv.accounts.length
      : 0.07;
  const weightedTER = totalBalance > 0
    ? inv.accounts.reduce((s, a) => s + a.balance * a.expenseRatio, 0) / totalBalance
    : inv.accounts.length > 0
      ? inv.accounts.reduce((s, a) => s + a.expenseRatio, 0) / inv.accounts.length
      : 0;
  const netReturn = weightedReturn - weightedTER;

  // Projections (simple compound interest with monthly contributions)
  const projectValue = (years: number): number => {
    const monthlyRate = netReturn / 12;
    const months = years * 12;
    const currentValue = totalBalance;
    // FV of lump sum + FV of annuity
    const fvLump = currentValue * Math.pow(1 + monthlyRate, months);
    const fvAnnuity = totalMonthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    return fvLump + (monthlyRate > 0 ? fvAnnuity : totalMonthly * months);
  };

  // Current year summary
  const currentYear = new Date().getFullYear();
  const yearSummary = sim.annualSummaries.find((s) => s.year === currentYear);

  // TER drag over time
  const terDrag10 = (() => {
    const withTER = projectValue(10);
    const monthlyRate = weightedReturn / 12;
    const months = 120;
    const currentValue = totalBalance;
    const fvLump = currentValue * Math.pow(1 + monthlyRate, months);
    const fvAnnuity = totalMonthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    const withoutTER = fvLump + (monthlyRate > 0 ? fvAnnuity : totalMonthly * months);
    return withoutTER - withTER;
  })();

  return (
    <div className="space-y-3">
      <CalculationPanel title="Portfolio Overview">
        <CalcSection>
          {savingsAccounts.map((account) => (
            <CalcLine key={account.id} label={account.name} value={cur(account.balance)} />
          ))}
          {savingsAccounts.length > 0 && <CalcLine label="Emergency fund target" value={cur(inv.emergencyFund)} dimmed />}
          {sweepTarget && <CalcLine label="Surplus sweep target" value={sweepTarget.name} dimmed />}
          <CalcSeparator />
          {inv.accounts.filter((account) => account.type !== 'savings').map((a) => (
            <CalcLine key={a.id} label={a.name} value={cur(a.balance)} />
          ))}
          <CalcSeparator />
          <CalcLine label="Total across accounts" value={cur(totalBalance)} bold />
          <CalcLine label="Monthly contributions" value={cur(totalMonthly)} />
          <CalcLine label="Annual contributions" value={cur(totalMonthly * 12)} dimmed />
        </CalcSection>
      </CalculationPanel>

      <CalculationPanel title="Returns & Costs">
        <CalcSection>
          <CalcLine label="Weighted avg return" value={pct(weightedReturn)} />
          <CalcLine label="Weighted avg TER" value={`- ${pct(weightedTER)}`} />
          <CalcSeparator />
          <CalcLine label="Net return" value={pct(netReturn)} bold accent />
        </CalcSection>
        {inv.accounts.length > 1 && (
          <CalcSection title="Per Account">
            {inv.accounts.map((a) => (
              <CalcLine key={a.id} label={a.name} value={`${pct(a.expectedReturn)} − ${pct(a.expenseRatio)}`} />
            ))}
          </CalcSection>
        )}
        <CalcNote>
          TER drag over 10 years: ~{cur(terDrag10)}. Lower expense ratios compound to significant savings.
        </CalcNote>
      </CalculationPanel>

      <CalculationPanel title="Compound Growth">
        <CalcSection title="Projections (net of TER)">
          <CalcLine label="Current total" value={cur(totalBalance)} />
          <CalcLine label="In 5 years" value={cur(projectValue(5))} />
          <CalcLine label="In 10 years" value={cur(projectValue(10))} />
          <CalcLine label="In 20 years" value={cur(projectValue(20))} />
          <CalcLine label="In 30 years" value={cur(projectValue(30))} />
        </CalcSection>
        <CalcNote>
          Assumes constant {pct(netReturn)} net return and {cur(totalMonthly)}/mo contributions. Real returns will vary.
        </CalcNote>
      </CalculationPanel>

      {yearSummary && (
        <CalculationPanel title={`${currentYear} Simulation`}>
          <CalcSection>
            <CalcLine label="Cash savings" value={cur(yearSummary.endCashBalance)} />
            <CalcLine label="Invested assets" value={cur(yearSummary.endInvestmentValue)} bold />
            <CalcLine label="Liquid total" value={cur(yearSummary.endLiquidNetWorth)} bold accent />
            <CalcSeparator />
            <CalcLine label="Savings interest" value={cur(yearSummary.cashReturns)} />
            <CalcLine label="Investment returns" value={cur(yearSummary.investmentReturns)} />
            <CalcLine label="Cash contributions" value={cur(yearSummary.totalCashContributions)} />
            <CalcLine label="Investment contributions" value={cur(yearSummary.totalInvestmentContributions)} />
            {yearSummary.taxBox3 > 0 && (
              <>
                <CalcSeparator />
                <CalcLine label="Box 3 tax" value={`- ${cur(yearSummary.taxBox3)}`} accent />
                <CalcLine label="After-tax investment return" value={cur(yearSummary.investmentReturns - yearSummary.taxBox3)} dimmed />
              </>
            )}
          </CalcSection>
        </CalculationPanel>
      )}

      {sim.fireNumber > 0 && (
        <CalculationPanel title="FIRE Progress">
          <CalcSection>
            <CalcLine label="Liquid net worth" value={cur(sim.currentLiquidNetWorth)} />
            <CalcLine label="FIRE target" value={cur(sim.fireNumber)} />
            <CalcSeparator />
            <CalcLine
              label="Progress"
              value={pct(Math.min(1, sim.currentLiquidNetWorth / sim.fireNumber))}
              bold
              accent
            />
            {sim.fireAge && <CalcLine label="Projected FIRE age" value={num(sim.fireAge, 1)} />}
          </CalcSection>
        </CalculationPanel>
      )}
    </div>
  );
}
