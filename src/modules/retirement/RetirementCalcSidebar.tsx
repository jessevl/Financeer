import { useActiveScenario, useSettings } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct, num } from '@/components/common/CalculationPanel';

export function RetirementCalcSidebar() {
  const scenario = useActiveScenario();
  const settings = useSettings();
  const sim = useSimulation();
  const { retirement: ret, expenses: exp } = scenario;
  const inflationRate = exp.customInflationRate ?? settings.inflationRate;

  // FIRE number derivation
  const fireNumber = ret.desiredAnnualSpending / ret.safeWithdrawalRate;

  // Inflation-adjusted FIRE target at target retirement age
  // yearsToTarget: from current age (first sim year) to target retirement age
  const currentSimAge = sim.annualSummaries[0]?.age ?? ret.targetAge;
  const yearsToTarget = Math.max(0, ret.targetAge - currentSimAge);
  const nominalFireAtRetirement = fireNumber * Math.pow(1 + inflationRate, yearsToTarget);

  // Current expenses from data
  const monthlyFixed = exp.monthlyFixed.reduce((s, e) => s + e.amount, 0);
  const monthlyVariable = exp.monthlyVariable.reduce((s, e) => s + e.amount, 0);
  const annualExpenses = exp.annualExpenses.reduce((s, e) => s + e.amount, 0);
  const healthcare = exp.healthcareMonthlyPremium * 12 + exp.healthcareDeductible;
  const childCost = exp.children.reduce((s, c) => s + c.monthlyExpense, 0) * 12;
  const currentAnnualExpenses = (monthlyFixed + monthlyVariable) * 12 + annualExpenses + healthcare + childCost;

  // Pension income
  const annualAOW = ret.aowMonthlyAmount * 12;
  const annualEmployerPension = ret.pensionMonthlyAmount * 12;
  const totalPensionIncome = annualAOW + annualEmployerPension;

  // Spending from portfolio (after pension)
  const spendingFromPortfolio = Math.max(0, ret.desiredAnnualSpending - totalPensionIncome);
  const adjustedFireNumber = spendingFromPortfolio / ret.safeWithdrawalRate;

  // Withdrawal schedule
  const retirementAge = ret.targetAge;
  const aowAge = ret.aowStartAge;
  const preAowSpending = ret.desiredAnnualSpending; // No pension yet
  const postAowSpending = spendingFromPortfolio; // Pension covers part

  return (
    <div className="space-y-3">
      <CalculationPanel title="FIRE Number">
        <CalcSection title="Base (today's money)">
          <CalcLine label="Annual spending" value={cur(ret.desiredAnnualSpending)} />
          <CalcLine label="÷ SWR" value={pct(ret.safeWithdrawalRate)} />
          <CalcSeparator />
          <CalcLine label="FIRE number" value={cur(fireNumber)} bold />
        </CalcSection>

        {yearsToTarget > 0 && (
          <CalcSection title="Inflation-adjusted (at retirement)">
            <CalcLine label="FIRE number today" value={cur(fireNumber)} />
            <CalcLine label={`× (1 + ${pct(inflationRate)})^${yearsToTarget.toFixed(0)} yr`} value="" dimmed />
            <CalcSeparator />
            <CalcLine label={`Nominal target at age ${ret.targetAge}`} value={cur(nominalFireAtRetirement)} bold accent />
          </CalcSection>
        )}

        {totalPensionIncome > 0 && (
          <CalcSection title="Adjusted for Pension">
            <CalcLine label="Desired spending" value={cur(ret.desiredAnnualSpending)} />
            <CalcLine label="− Pension income" value={`- ${cur(totalPensionIncome)}`} />
            <CalcLine label="From portfolio" value={cur(spendingFromPortfolio)} indent={1} />
            <CalcLine label="÷ SWR" value={pct(ret.safeWithdrawalRate)} />
            <CalcSeparator />
            <CalcLine label="Adjusted FIRE number" value={cur(adjustedFireNumber)} bold accent />
          </CalcSection>
        )}

        <CalcNote>
          Spending target is in <strong>today's money</strong>. The simulation inflates the required portfolio at {pct(inflationRate)}/year (from Settings).
          The {pct(ret.safeWithdrawalRate)} SWR: withdraw {pct(ret.safeWithdrawalRate)} of your portfolio annually. Historically sustains portfolios for 30+ years.
        </CalcNote>
      </CalculationPanel>

      <CalculationPanel title="Current vs Target">
        <CalcSection>
          <CalcLine label="Current liquid NW" value={cur(sim.currentLiquidNetWorth)} />
          <CalcLine label="FIRE target" value={cur(sim.fireNumber)} />
          <CalcSeparator />
          <CalcLine label="Gap" value={cur(Math.max(0, sim.fireNumber - sim.currentLiquidNetWorth))} bold />
          <CalcLine label="Progress" value={pct(Math.min(1, sim.currentLiquidNetWorth / (sim.fireNumber || 1)))} accent />
        </CalcSection>

        <CalcSection title="Projections">
          {sim.fireAge && <CalcLine label="FIRE age" value={num(sim.fireAge, 1)} bold />}
          {sim.yearsToFire && <CalcLine label="Years to FIRE" value={num(sim.yearsToFire, 1)} />}
          <CalcLine label="NW at retirement" value={cur(sim.projectedNetWorthAtRetirement)} />
          <CalcLine label="Current savings rate" value={pct(sim.savingsRate)} />
        </CalcSection>
      </CalculationPanel>

      <CalculationPanel title="Coast FIRE">
        <CalcSection>
          <CalcLine label="FIRE target at retirement" value={cur(nominalFireAtRetirement)} />
          <CalcLine label="÷ growth factor" value={`(1 + avg return)^${yearsToTarget.toFixed(0)} yr`} dimmed />
          <CalcSeparator />
          <CalcLine label="Coast FIRE number" value={cur(sim.coastFireNumber)} bold />
          <CalcLine label="Current liquid NW" value={cur(sim.currentLiquidNetWorth)} />
          <CalcSeparator />
          {sim.coastFireAge !== null ? (
            <CalcLine label="Status" value="Coast FIRE reached!" bold accent />
          ) : (
            <CalcLine label="Gap" value={cur(Math.max(0, sim.coastFireNumber - sim.currentLiquidNetWorth))} bold />
          )}
        </CalcSection>
        <CalcNote>
          Coast FIRE = the amount you need <strong>today</strong> so that compound growth alone (no further contributions) reaches your FIRE target by retirement age.
        </CalcNote>
      </CalculationPanel>

      <CalculationPanel title="Spending Comparison">
        <CalcSection>
          <CalcLine label="Current annual expenses" value={cur(currentAnnualExpenses)} />
          <CalcLine label="FIRE spending target" value={cur(ret.desiredAnnualSpending)} />
          <CalcSeparator />
          {ret.desiredAnnualSpending >= currentAnnualExpenses ? (
            <CalcLine label="Buffer" value={cur(ret.desiredAnnualSpending - currentAnnualExpenses)} />
          ) : (
            <CalcLine label="Need to reduce by" value={cur(currentAnnualExpenses - ret.desiredAnnualSpending)} accent />
          )}
        </CalcSection>
      </CalculationPanel>

      <CalculationPanel title="Pension Income">
        <CalcSection title="State Pension (AOW)">
          <CalcLine label="Start age" value={num(ret.aowStartAge, 0)} />
          <CalcLine label="Monthly" value={cur(ret.aowMonthlyAmount)} />
          <CalcLine label="Annual" value={cur(annualAOW)} bold />
        </CalcSection>

        {ret.pensionMonthlyAmount > 0 && (
          <CalcSection title="Employer Pension">
            <CalcLine label="Monthly" value={cur(ret.pensionMonthlyAmount)} />
            <CalcLine label="Annual" value={cur(annualEmployerPension)} bold />
          </CalcSection>
        )}

        <CalcSection title="Total Pension">
          <CalcLine label="Annual pension income" value={cur(totalPensionIncome)} bold accent />
          <CalcLine label="Covers" value={pct(totalPensionIncome / (ret.desiredAnnualSpending || 1))} dimmed />
        </CalcSection>
      </CalculationPanel>

      {retirementAge < aowAge && totalPensionIncome > 0 && (
        <CalculationPanel title="Withdrawal Phases">
          <CalcSection title={`Phase 1: Age ${retirementAge}–${aowAge}`}>
            <CalcLine label="No pension yet" value="" dimmed />
            <CalcLine label="Withdraw from portfolio" value={cur(preAowSpending)} bold />
            <CalcLine label="Duration" value={`${aowAge - retirementAge} yr`} />
            <CalcLine label="Total withdrawn" value={cur(preAowSpending * (aowAge - retirementAge))} dimmed />
          </CalcSection>
          <CalcSection title={`Phase 2: Age ${aowAge}+`}>
            <CalcLine label="Pension income" value={cur(totalPensionIncome)} />
            <CalcLine label="Withdraw from portfolio" value={cur(postAowSpending)} bold />
          </CalcSection>
          <CalcNote>
            Early retirement before AOW age ({aowAge}) means {aowAge - retirementAge} years of full portfolio withdrawal without pension support.
          </CalcNote>
        </CalculationPanel>
      )}
    </div>
  );
}
