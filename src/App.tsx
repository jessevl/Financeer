import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar, type ModuleKey } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardModule } from '@/modules/dashboard/DashboardModule';
import { IncomeModule } from '@/modules/income/IncomeModule';
import { ExpensesModule } from '@/modules/expenses/ExpensesModule';
import { HousingModule } from '@/modules/housing/HousingModule';
import { InvestmentsModule } from '@/modules/investments/InvestmentsModule';
import { RetirementModule } from '@/modules/retirement/RetirementModule';
import { TaxModule } from '@/modules/tax/TaxModule';
import { LifeEventsModule } from '@/modules/events/LifeEventsModule';
import { ToeslagenModule } from '@/modules/toeslagen/ToeslagenModule';
import { BreakdownModule } from '@/modules/breakdown/BreakdownModule';
import { SettingsModule } from '@/modules/settings/SettingsModule';
import { PersonalModule } from '@/modules/settings/PersonalModule';
import { ComparisonModule } from '@/modules/comparison/ComparisonModule';
import { MonteCarloModule } from '@/modules/montecarlo/MonteCarloModule';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { AboutModule } from '@/modules/about/AboutModule';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useStore } from '@/store';
import { useUndoRedoStore } from '@/store/undoRedo';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---- Error Boundary ----
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground">
          <div className="text-center space-y-4 max-w-md px-6">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  localStorage.removeItem('financeer-storage');
                  window.location.reload();
                }}
              >
                Reset data
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const accentColor = useStore((s) => s.settings.accentColor);
  const themeVariant = useStore((s) => s.settings.themeVariant);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDark ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Apply theme variant (warm / cool)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-cool');
    if (themeVariant === 'cool') {
      root.classList.add('theme-cool');
    }
  }, [themeVariant]);

  // Apply accent color
  useEffect(() => {
    const root = document.documentElement;
    const accentClasses = ['accent-coral', 'accent-honey', 'accent-blue', 'accent-green', 'accent-red', 'accent-purple', 'accent-pink', 'accent-teal', 'accent-stone'];
    accentClasses.forEach((c) => root.classList.remove(c));
    if (accentColor && accentColor !== 'default') {
      root.classList.add(`accent-${accentColor}`);
    }
  }, [accentColor]);
}

const modules: Record<ModuleKey, React.ComponentType> = {
  dashboard: DashboardModule,
  breakdown: BreakdownModule,
  comparison: ComparisonModule,
  montecarlo: MonteCarloModule,
  income: IncomeModule,
  expenses: ExpensesModule,
  housing: HousingModule,
  investments: InvestmentsModule,
  retirement: RetirementModule,
  tax: TaxModule,
  toeslagen: ToeslagenModule,
  events: LifeEventsModule,
  personal: PersonalModule,
  about: AboutModule,
  settings: SettingsModule,
};

function App() {
  useTheme();
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when navigating
  const handleModuleChange = useCallback((key: ModuleKey) => {
    setActiveModule(key);
    setMobileMenuOpen(false);
  }, []);

  // Undo/redo keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
  const undo = useUndoRedoStore((s) => s.undo);
  const redo = useUndoRedoStore((s) => s.redo);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      redo();
    }
  }, [undo, redo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const ActiveModule = modules[activeModule];

  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <OnboardingWizard />
        <div className="flex h-screen overflow-hidden layout-background">
          {/* Desktop sidebar — hidden on mobile */}
          <div className={cn(
            'hidden md:block flex-shrink-0 transition-all duration-200',
            sidebarCollapsed ? 'w-16' : 'w-56'
          )}>
            <div className="sidebar-recessed h-full">
              <div className="sidebar-content h-full overflow-hidden">
                <Sidebar
                  activeModule={activeModule}
                  onModuleChange={setActiveModule}
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
              </div>
            </div>
          </div>

          {/* Mobile sidebar — Sheet drawer */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" showCloseButton={false} className="w-64 p-0 md:hidden">
              <div className="sidebar-recessed h-full">
                <div className="sidebar-content h-full overflow-hidden">
                  <Sidebar
                    activeModule={activeModule}
                    onModuleChange={handleModuleChange}
                    collapsed={false}
                    onToggleCollapse={() => setMobileMenuOpen(false)}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Main content — elevated paper surface */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden paper-surface paper-surface-animate">
            <TopBar
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
            />
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              <div className="md:hidden mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Best experience is on laptop or tablet. You can still use mobile, and calculation panels are shown below each module.
              </div>
              <ActiveModule />
            </main>
          </div>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
