import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldCheck,
  WifiOff,
  Download,
  HardDrive,
  Lightbulb,
  LayoutGrid,
  TrendingUp,
  Sparkles,
  GitCompareArrows,
  Calendar,
  Calculator,
  Info,
  AlertTriangle,
} from 'lucide-react';

export function AboutModule() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">About Financeer</h2>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Understand how Financeer works, your privacy, and how to get the most out of it.
        </p>
      </div>

      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Important Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-[var(--color-text-secondary)] space-y-2">
          <p>
            Financeer is a planning tool and does <strong>not</strong> provide legal, tax, investment, or financial advice.
          </p>
          <p>
            We cannot guarantee that all calculations are correct, complete, or up to date for your exact personal situation.
            Always verify important decisions with official sources (Belastingdienst) or a qualified professional.
          </p>
        </CardContent>
      </Card>

      {/* What is Financeer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            What is Financeer?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          <p>
            Financeer is a comprehensive financial planning tool designed specifically for the <strong>Dutch tax system</strong>.
            It simulates your entire financial future — from your current income and expenses through retirement — taking into
            account Dutch income tax brackets, social contributions, toeslagen (government allowances), Box 2 & 3 taxation,
            mortgage interest deductions, and more.
          </p>
          <p>
            Whether you're planning for early retirement (FIRE), evaluating a home purchase, or just want to understand
            where your money goes each year, Financeer gives you a detailed year-by-year projection with real Dutch tax calculations.
          </p>
        </CardContent>
      </Card>

      {/* Privacy & Offline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Privacy & Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              icon: WifiOff,
              title: 'Fully offline — no server involved',
              desc: 'Financeer sends absolutely no data to any server. There is no backend, no analytics, no tracking. All calculations run entirely in your browser. You can disconnect from the internet and continue using the app normally.',
            },
            {
              icon: HardDrive,
              title: 'Data stored in your browser',
              desc: 'All your scenarios and settings are saved in your browser\'s local storage. No account is needed, and nothing is synced to the cloud. If you clear your browser data or switch browsers, your data will be gone.',
            },
            {
              icon: Download,
              title: 'Export your data regularly',
              desc: 'Use the Export option in the top-right menu (⋯) to download your data as a JSON file. This is your only backup method. We strongly recommend exporting after making significant changes. You can re-import the file anytime.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 h-fit">
                <Icon className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* How to use */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            How to Use Financeer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              {
                step: '1',
                title: 'Fill in your Planning sections',
                desc: 'Start with the Planning modules in the sidebar: Personal details, Income, Housing, Expenses, Investments, Retirement goals, Tax settings, Toeslagen, and Life Events. Each page has a real-time calculation panel showing the impact of your inputs.',
                icon: LayoutGrid,
              },
              {
                step: '2',
                title: 'Review the simulation results',
                desc: 'The Dashboard shows FIRE progress, net worth projections, and key financial metrics. The Breakdown table gives you a year-by-year detailed view. Monte Carlo runs thousands of randomized simulations to test how your plan holds up under different market conditions.',
                icon: TrendingUp,
              },
              {
                step: '3',
                title: 'Create and compare scenarios',
                desc: 'Use the scenario picker in the top bar to create alternatives (e.g. "Buy a house" vs "Keep renting", or "FIRE at 45" vs "FIRE at 50"). The Compare module lets you view them side by side.',
                icon: GitCompareArrows,
              },
              {
                step: '4',
                title: 'Model life events',
                desc: 'Add future events like having children, a career change, or receiving an inheritance. These affect the simulation from the year they occur, giving you a more realistic long-term picture.',
                icon: Calendar,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="flex gap-3">
                <div className="p-2 rounded-lg bg-[var(--color-accent-primary)]/10 h-fit">
                  <Icon className="h-4 w-4 text-[var(--color-accent-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Key Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'Dutch tax engine', desc: 'Box 1/2/3, tax credits, social contributions, Hillen correction' },
              { title: 'Toeslagen', desc: 'Zorgtoeslag, huurtoeslag, kinderopvangtoeslag, kindgebonden budget' },
              { title: 'Mortgage modeling', desc: 'Annuity & linear mortgages with HRA deduction' },
              { title: 'Investment simulation', desc: 'Real returns, dividend tax, Box 3 forfaitair rendement' },
              { title: 'Monte Carlo analysis', desc: 'Stress-test your plan with randomized market returns' },
              { title: 'Life events timeline', desc: 'Children, career changes, inheritance, emigration' },
              { title: 'Scenario comparison', desc: 'Side-by-side analysis of different life choices' },
              { title: 'Undo / redo', desc: 'Full undo history with ⌘Z / ⌘⇧Z keyboard shortcuts' },
            ].map(({ title, desc }) => (
              <div key={title} className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tips & Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li className="flex gap-2">
              <span className="text-[var(--color-accent-primary)] font-bold">·</span>
              Start with your core numbers (income, rent/mortgage, monthly expenses) — you can refine tax and investment details later.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-accent-primary)] font-bold">·</span>
              Create a "baseline" scenario first, then duplicate it to explore alternatives.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-accent-primary)] font-bold">·</span>
              Use the calculation sidebars on each page to verify numbers match your payslip or tax return.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-accent-primary)] font-bold">·</span>
              Export your data after every significant change — there's no cloud backup.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-accent-primary)] font-bold">·</span>
              Run Monte Carlo with different allocation strategies to understand risk vs. reward.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-accent-primary)] font-bold">·</span>
              Check that your tax law year matches the year you want to simulate against (Settings page).
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
