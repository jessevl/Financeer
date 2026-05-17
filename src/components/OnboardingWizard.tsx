import { useState } from 'react';
import { useStore } from '@/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput, PercentInput } from '@/components/common/FormFields';
import { createInvestmentAccount } from '@/data/defaults';
import {
  Rocket,
  User,
  Wallet,
  Home,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  WifiOff,
  Download,
  LayoutGrid,
  Compass,
  Sparkles,
} from 'lucide-react';

// ---- Types ----

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

// ---- Step 0: Welcome ----

function WelcomeStep({ onNext }: StepProps) {
  return (
    <div className="text-center space-y-5 py-4">
      <div className="flex justify-center">
        <div className="p-4 rounded-2xl bg-[var(--color-accent-primary)]/10">
          <Rocket className="h-12 w-12 text-[var(--color-accent-primary)]" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Welcome to Financeer</h3>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          A powerful financial planning tool built for the Dutch tax system.
          Model your income, expenses, investments, and retirement — and see
          your entire financial future unfold year by year.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-left max-w-sm mx-auto">
        {[
          { icon: TrendingUp, text: 'FIRE & retirement planning' },
          { icon: LayoutGrid, text: 'Dutch taxes, toeslagen & more' },
          { icon: Sparkles, text: 'Monte Carlo simulations' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex flex-col items-center gap-1.5 text-center p-2 rounded-lg bg-muted/50">
            <Icon className="h-4 w-4 text-[var(--color-accent-primary)]" />
            <span className="text-[11px] leading-tight text-muted-foreground">{text}</span>
          </div>
        ))}
      </div>

      <Button onClick={onNext} className="gap-2">
        Get started <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---- Step 1: Privacy & Offline ----

function PrivacyStep({ onNext, onBack }: StepProps) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold">100% Private & Offline</h3>
          <p className="text-xs text-muted-foreground">Your financial data never leaves your device.</p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          {
            icon: WifiOff,
            title: 'No server, no tracking',
            desc: 'Financeer sends absolutely no data to any server. All calculations run locally in your browser. You can disconnect from the internet and keep using it.',
          },
          {
            icon: ShieldCheck,
            title: 'Stored in your browser',
            desc: 'Your scenarios are saved in local storage. No account needed, no cloud sync. Clear your browser data and it\'s gone.',
          },
          {
            icon: Download,
            title: 'Download your data',
            desc: 'Export your scenarios as a JSON file anytime from the top menu. We strongly recommend doing this regularly — it\'s your only backup.',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-3 p-3 rounded-lg bg-muted/50">
            <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-1 ml-auto">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Step 2: How It Works ----

function HowItWorksStep({ onNext, onBack }: StepProps) {
  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Compass className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">How Financeer Works</h3>
          <p className="text-xs text-muted-foreground">A quick overview so you know what to expect.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] text-xs font-bold">1</span>
            Enter your financial details
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1 ml-7">
            Use the <strong>Planning</strong> sections in the sidebar — income, housing, expenses, investments, tax settings, and more. Each page has a calculation sidebar so you can see the impact instantly.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] text-xs font-bold">2</span>
            View the simulation results
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1 ml-7">
            The <strong>Dashboard</strong> shows your FIRE progress, net worth projection, and key metrics. The <strong>Breakdown</strong> table shows every year in detail. <strong>Monte Carlo</strong> runs thousands of randomized scenarios.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] text-xs font-bold">3</span>
            Compare scenarios
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1 ml-7">
            Create multiple scenarios (e.g. "Buy a house" vs "Keep renting") and compare them side by side. Use the scenario picker in the top bar to switch between them.
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Financeer provides estimates for planning support. We cannot guarantee correctness, completeness, or suitability for your specific tax/legal situation.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-1 ml-auto">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Step 3: Personal ----

function PersonalStep({ onNext, onBack }: StepProps) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">About You</h3>
          <p className="text-xs text-muted-foreground">We use this to calculate your age throughout the simulation.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ob-dob">Date of birth</Label>
          <Input
            id="ob-dob"
            type="date"
            value={settings.dateOfBirth}
            onChange={(e) => updateSettings({ dateOfBirth: e.target.value })}
            className="max-w-xs"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-1 ml-auto">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Step 4: Income ----

function IncomeStep({ onNext, onBack }: StepProps) {
  const scenario = useStore((s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId) ?? s.scenarios[0]);
  const updateIncome = useStore((s) => s.updateIncome);
  const inc = scenario.income;

  const update = (patch: Partial<typeof inc>) => updateIncome(scenario.id, { ...inc, ...patch });

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Wallet className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Your Income</h3>
          <p className="text-xs text-muted-foreground">Your annual gross salary. You can add bonuses and partner income later.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Annual gross salary</Label>
          <CurrencyInput value={inc.grossSalary} onChange={(v) => update({ grossSalary: v })} />
        </div>
        <div className="space-y-1.5">
          <Label>Holiday allowance</Label>
          <PercentInput value={inc.holidayAllowance} onChange={(v) => update({ holidayAllowance: v })} />
          <p className="text-xs text-muted-foreground">Standard in NL is 8%</p>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-1 ml-auto">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Step 5: Expenses ----

function ExpensesStep({ onNext, onBack }: StepProps) {
  const scenario = useStore((s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId) ?? s.scenarios[0]);
  const updateExpenses = useStore((s) => s.updateExpenses);
  const exp = scenario.expenses;

  const monthlyRent = (exp.monthlyFixed ?? []).find((e) => e.label.toLowerCase().includes('rent'))?.amount ?? 0;

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Home className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Monthly Expenses</h3>
          <p className="text-xs text-muted-foreground">Rough monthly costs. You can break these down in detail later.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Healthcare premium (monthly)</Label>
          <CurrencyInput value={exp.healthcareMonthlyPremium} onChange={(v) => updateExpenses(scenario.id, { ...exp, healthcareMonthlyPremium: v })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Add rent, groceries, and other costs in the Expenses module after setup.
          {monthlyRent > 0 && ` Current rent: €${monthlyRent}/mo`}
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-1 ml-auto">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Step 6: Goals ----

function GoalsStep({ onNext, onBack }: StepProps) {
  const scenario = useStore((s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId) ?? s.scenarios[0]);
  const updateRetirement = useStore((s) => s.updateRetirement);
  const updateInvestments = useStore((s) => s.updateInvestments);
  const ret = scenario.retirement;
  const inv = scenario.investments;
  const savingsAccount = inv.accounts.find((account) => account.type === 'savings');

  const updateSavingsBalance = (balance: number) => {
    if (savingsAccount) {
      updateInvestments(scenario.id, {
        ...inv,
        accounts: inv.accounts.map((account) => account.id === savingsAccount.id ? { ...account, balance } : account),
      });
      return;
    }

    updateInvestments(scenario.id, {
      ...inv,
      accounts: [createInvestmentAccount('savings', { balance }), ...inv.accounts],
    });
  };

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Financial Goals</h3>
          <p className="text-xs text-muted-foreground">When do you want to retire and how much do you have saved?</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Target retirement age</Label>
          <Input
            type="number"
            value={ret.targetAge}
            onChange={(e) => updateRetirement(scenario.id, { ...ret, targetAge: +e.target.value })}
            className="max-w-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Starting savings balance</Label>
          <CurrencyInput value={savingsAccount?.balance ?? 0} onChange={updateSavingsBalance} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} className="gap-1 ml-auto">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---- Step 7: All Set ----

function AllSetStep({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  return (
    <div className="text-center space-y-5 py-4">
      <div className="flex justify-center">
        <div className="p-4 rounded-2xl bg-emerald-500/10">
          <Check className="h-10 w-10 text-emerald-600" />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">You're all set!</h3>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          Your initial data has been saved. Explore each section in the sidebar to fine-tune your numbers — the simulation updates in real-time.
        </p>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left max-w-sm mx-auto">
        <div className="flex gap-2">
          <Download className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Remember to export!</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              Your data lives only in this browser. Use the <strong>Export</strong> option in the top-right menu regularly to keep a backup.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-center pt-2">
        <Button variant="ghost" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onFinish} className="gap-1">
          <Check className="h-4 w-4" /> Start exploring
        </Button>
      </div>
    </div>
  );
}

// ---- Wizard Container ----

const STEP_COUNT = 8;

export function OnboardingWizard() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [step, setStep] = useState(0);

  if (settings.onboardingCompleted) return null;

  const handleFinish = () => {
    updateSettings({ onboardingCompleted: true });
  };

  const handleSkip = () => {
    updateSettings({ onboardingCompleted: true });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">Financeer Setup</DialogTitle>
          <DialogDescription className="sr-only">Quick setup wizard for new users</DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-1">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-[var(--color-accent-primary)]' : i < step ? 'w-1.5 bg-[var(--color-accent-primary)]/40' : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
        {step === 1 && <PrivacyStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <HowItWorksStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <PersonalStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <IncomeStep onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && <ExpensesStep onNext={() => setStep(6)} onBack={() => setStep(4)} />}
        {step === 6 && <GoalsStep onNext={() => setStep(7)} onBack={() => setStep(5)} />}
        {step === 7 && <AllSetStep onFinish={handleFinish} onBack={() => setStep(6)} />}

        <DialogFooter className="sm:justify-center">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs text-muted-foreground">
            Skip setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
