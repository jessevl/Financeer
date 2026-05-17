import { useActiveScenario, useSettings } from '@/store';
import { useSimulation } from '@/hooks/useSimulation';
import { CalculationPanel, CalcSection, CalcLine, CalcSeparator, CalcNote, cur, pct, num } from '@/components/common/CalculationPanel';
import { buildTaxAdvantagedIncomePhases, calculateAnnualAowIncome, calculateMiddelloonPension, calculateRetirementCapitalTarget } from '@/engine/simulation';

export function RetirementCalcSidebar() {
  const scenario = useActiveScenario();
  const settings = useSettings();
  const sim = useSimulation();
  const { retirement: ret, expenses: exp, income } = scenario;
  const inflationRate = exp.customInflationRate ?? settings.inflationRate;
  const isCoupleHousehold = scenario.tax.filingType === 'couple';
  const partnerAowMonthlyAmount = ret.partnerAowMonthlyAmount ?? ret.aowMonthlyAmount;

  // Inflation-adjusted FIRE target at target retirement age
  // yearsToTarget: from current age (first sim year) to target retirement age
  const currentSimAge = sim.months[0]?.age ?? sim.annualSummaries[0]?.age ?? ret.targetAge;
  const yearsToTarget = Math.max(0, ret.targetAge - currentSimAge);
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  // Current expenses from data
  const monthlyFixed = exp.monthlyFixed.reduce((s, e) => s + e.amount, 0);
  const monthlyVariable = exp.monthlyVariable.reduce((s, e) => s + e.amount, 0);
  const annualExpenses = exp.annualExpenses.reduce((s, e) => s + e.amount, 0);
  const healthcare = exp.healthcareMonthlyPremium * 12 + exp.healthcareDeductible;
  const childCost = exp.children.reduce((s, c) => s + c.monthlyExpense, 0) * 12;
  const currentAnnualExpenses = (monthlyFixed + monthlyVariable) * 12 + annualExpenses + healthcare + childCost;

  // Pension income
  const annualAOW = calculateAnnualAowIncome(ret.aowMonthlyAmount, isCoupleHousehold, partnerAowMonthlyAmount);
  const effectivePensionMonthly = (ret.pensionType === 'middelloon')
    ? calculateMiddelloonPension(ret, income.grossSalary)
    : ret.pensionMonthlyAmount;
  const partnerEffectivePensionMonthly = isCoupleHousehold
    ? ((ret.pensionType === 'middelloon')
      ? calculateMiddelloonPension(ret, income.partnerGrossSalary)
      : (ret.partnerPensionMonthlyAmount ?? 0))
    : 0;
  const annualEmployerPension = (effectivePensionMonthly + partnerEffectivePensionMonthly) * 12;
  const taxAdvantagedIncomePhases = buildTaxAdvantagedIncomePhases({
    accounts: scenario.investments.accounts,
    currentDate: startOfYear,
    currentAge: currentSimAge,
    settings,
    isCoupleHousehold,
  });

  const guaranteedIncomeAtAge = (age: number) => {
    let incomeAtAge = 0;
    if (age >= ret.aowStartAge) incomeAtAge += annualAOW;
    if (age >= (ret.pensionStartAge ?? ret.targetAge)) incomeAtAge += annualEmployerPension;
    for (const phase of taxAdvantagedIncomePhases) {
      if (age >= phase.startAge && (phase.endAge === undefined || age < phase.endAge)) {
        incomeAtAge += phase.annualIncome;
      }
    }
    return incomeAtAge;
  };

  const guaranteedIncomeAtRetirement = guaranteedIncomeAtAge(ret.targetAge);

  const fireNumber = calculateRetirementCapitalTarget({
    currentAge: currentSimAge,
    desiredAnnualSpending: ret.desiredAnnualSpending,
    safeWithdrawalRate: ret.safeWithdrawalRate,
    pensionStartAge: ret.pensionStartAge ?? ret.targetAge,
    annualPensionIncome: annualEmployerPension,
    aowStartAge: ret.aowStartAge,
    annualAowIncome: annualAOW,
    additionalIncomePhases: taxAdvantagedIncomePhases,
  });
  const nominalFireAtRetirement = calculateRetirementCapitalTarget({
    currentAge: ret.targetAge,
    desiredAnnualSpending: ret.desiredAnnualSpending * Math.pow(1 + inflationRate, yearsToTarget),
    safeWithdrawalRate: ret.safeWithdrawalRate,
    pensionStartAge: ret.pensionStartAge ?? ret.targetAge,
    annualPensionIncome: annualEmployerPension,
    aowStartAge: ret.aowStartAge,
    annualAowIncome: annualAOW,
    additionalIncomePhases: taxAdvantagedIncomePhases,
  });

  // Spending from portfolio (after pension)
  const spendingFromPortfolio = Math.max(0, ret.desiredAnnualSpending - guaranteedIncomeAtRetirement);
  const adjustedFireNumber = spendingFromPortfolio / ret.safeWithdrawalRate;

  // Withdrawal schedule
  const retirementAge = ret.targetAge;
  const aowAge = ret.aowStartAge;
  const preAowSpending = Math.max(0, ret.desiredAnnualSpending - guaranteedIncomeAtAge(retirementAge));
  const postAowSpending = Math.max(0, ret.desiredAnnualSpending - guaranteedIncomeAtAge(aowAge));

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

        {guaranteedIncomeAtRetirement > 0 && (
          <CalcSection title="Adjusted for Retirement Income">
            <CalcLine label="Desired spending" value={cur(ret.desiredAnnualSpending)} />
            <CalcLine label={`− Income active at age ${ret.targetAge}`} value={`- ${cur(guaranteedIncomeAtRetirement)}`} />
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
          <CalcLine label={isCoupleHousehold ? 'You monthly' : 'Monthly'} value={cur(ret.aowMonthlyAmount)} />
          {isCoupleHousehold && <CalcLine label="Partner monthly" value={cur(partnerAowMonthlyAmount)} />}
          <CalcLine label="Annual" value={cur(annualAOW)} bold />
        </CalcSection>

        {(ret.pensionType === 'middelloon') ? (
          <CalcSection title="Employer Pension (Middelloon)">
            <CalcLine label="Your gross salary" value={cur(income.grossSalary)} />
            {isCoupleHousehold && <CalcLine label="Partner gross salary" value={cur(income.partnerGrossSalary)} />}
            <CalcLine label="− Franchise" value={`- ${cur(ret.pensionFranchise ?? 17545)}`} />
            <CalcLine label="Your pension base" value={cur(Math.max(0, income.grossSalary - (ret.pensionFranchise ?? 17545)))} />
            {isCoupleHousehold && <CalcLine label="Partner pension base" value={cur(Math.max(0, income.partnerGrossSalary - (ret.pensionFranchise ?? 17545)))} />}
            <CalcLine label="× Accrual rate" value={pct(ret.pensionAccrualRate ?? 0.01875)} />
            <CalcLine label={`× ${Math.max(0, ret.targetAge - (ret.pensionServiceStartAge ?? 25))} service years`} value="" dimmed />
            <CalcLine label="× Part-time factor" value={`${(ret.pensionPartTimeFactor ?? 1.0).toFixed(2)}`} dimmed />
            {(ret.pensionStartAge < ret.aowStartAge) && (
              <CalcLine label={`Early penalty (${ret.aowStartAge - ret.pensionStartAge} yr × ${pct(ret.pensionEarlyRetirementPenalty ?? 0.065)})`} value={pct((ret.pensionEarlyRetirementPenalty ?? 0.065) * (ret.aowStartAge - ret.pensionStartAge))} dimmed />
            )}
            <CalcSeparator />
            <CalcLine label={isCoupleHousehold ? 'You monthly' : 'Monthly'} value={cur(effectivePensionMonthly)} bold />
            {isCoupleHousehold && <CalcLine label="Partner monthly" value={cur(partnerEffectivePensionMonthly)} bold />}
            <CalcLine label="Annual" value={cur(annualEmployerPension)} bold accent />
          </CalcSection>
        ) : effectivePensionMonthly > 0 ? (
          <CalcSection title="Employer Pension">
            <CalcLine label={isCoupleHousehold ? 'You monthly' : 'Monthly'} value={cur(effectivePensionMonthly)} />
            {isCoupleHousehold && <CalcLine label="Partner monthly" value={cur(partnerEffectivePensionMonthly)} />}
            <CalcLine label="Annual" value={cur(annualEmployerPension)} bold />
          </CalcSection>
        ) : isCoupleHousehold && partnerEffectivePensionMonthly > 0 ? (
          <CalcSection title="Employer Pension">
            <CalcLine label="You monthly" value={cur(effectivePensionMonthly)} />
            <CalcLine label="Partner monthly" value={cur(partnerEffectivePensionMonthly)} />
            <CalcLine label="Annual" value={cur(annualEmployerPension)} bold />
          </CalcSection>
        ) : null}

        {taxAdvantagedIncomePhases.length > 0 && (
          <CalcSection title="Scheduled Account Payouts">
            {taxAdvantagedIncomePhases.map((phase) => (
              <CalcLine
                key={`${phase.label}-${phase.startAge}`}
                label={`${phase.label} (${num(phase.startAge, 0)}${phase.endAge !== undefined ? `-${num(phase.endAge, 0)}` : '+'})`}
                value={cur(phase.annualIncome)}
              />
            ))}
          </CalcSection>
        )}

        <CalcSection title="Income At Retirement Age">
          <CalcLine label={`Annual income at age ${ret.targetAge}`} value={cur(guaranteedIncomeAtRetirement)} bold accent />
          <CalcLine label="Covers" value={pct(guaranteedIncomeAtRetirement / (ret.desiredAnnualSpending || 1))} dimmed />
        </CalcSection>
      </CalculationPanel>

      {retirementAge < aowAge && (guaranteedIncomeAtAge(retirementAge) > 0 || guaranteedIncomeAtAge(aowAge) > 0) && (
        <CalculationPanel title="Withdrawal Phases">
          <CalcSection title={`Phase 1: Age ${retirementAge}–${aowAge}`}>
            <CalcLine label="Guaranteed income in phase" value={cur(guaranteedIncomeAtAge(retirementAge))} dimmed />
            <CalcLine label="Withdraw from portfolio" value={cur(preAowSpending)} bold />
            <CalcLine label="Duration" value={`${aowAge - retirementAge} yr`} />
            <CalcLine label="Total withdrawn" value={cur(preAowSpending * (aowAge - retirementAge))} dimmed />
          </CalcSection>
          <CalcSection title={`Phase 2: Age ${aowAge}+`}>
            <CalcLine label="Guaranteed income in phase" value={cur(guaranteedIncomeAtAge(aowAge))} />
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
