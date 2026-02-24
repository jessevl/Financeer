import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Home,
  TrendingUp,
  Target,
  Calendar,
  Settings,
  FileText,
  HandCoins,
  TableProperties,
  User,
  GitCompareArrows,
  Dice5,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type ModuleKey =
  | 'dashboard'
  | 'breakdown'
  | 'comparison'
  | 'montecarlo'
  | 'personal'
  | 'income'
  | 'expenses'
  | 'housing'
  | 'investments'
  | 'retirement'
  | 'tax'
  | 'toeslagen'
  | 'events'
  | 'about'
  | 'settings';

type NavSection = {
  label: string;
  items: { key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[];
};

const navSections: NavSection[] = [
  {
    label: 'Planning',
    items: [
      { key: 'personal', label: 'Personal', icon: User },
      { key: 'income', label: 'Income', icon: Wallet },
      { key: 'housing', label: 'Housing', icon: Home },
      { key: 'investments', label: 'Investments', icon: TrendingUp },
      { key: 'expenses', label: 'Expenses', icon: Receipt },
      { key: 'retirement', label: 'Retirement', icon: Target },
      { key: 'tax', label: 'Tax', icon: FileText },
      { key: 'toeslagen', label: 'Toeslagen', icon: HandCoins },
      { key: 'events', label: 'Life Events', icon: Calendar },
    ],
  },
  {
    label: 'Results',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'breakdown', label: 'Breakdown', icon: TableProperties },
      { key: 'comparison', label: 'Compare', icon: GitCompareArrows },
      { key: 'montecarlo', label: 'Monte Carlo', icon: Dice5 },
    ],
  },
];

interface SidebarProps {
  activeModule: ModuleKey;
  onModuleChange: (key: ModuleKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeModule, onModuleChange, collapsed }: SidebarProps) {
  return (
    <aside className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-4 pt-4 pb-3', collapsed && 'justify-center px-2')}>
        <img src="/icons/app-icon-small.svg" alt="Financeer" className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-lg tracking-tight text-[var(--color-text-primary)]">Financeer</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="px-3 pb-1 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
                  {section.label}
                </span>
              </div>
            )}
            {collapsed && (
              <div className="mx-2 my-1 border-t border-[var(--color-border-subtle)]" />
            )}
            <div className="space-y-0.5">
              {section.items.map(({ key, label, icon: Icon }) => {
                const isActive = activeModule === key;
                const button = (
                  <button
                    key={key}
                    onClick={() => onModuleChange(key)}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'glass-item text-[var(--color-nav-item-text-active)]'
                        : 'glass-item-subtle text-[var(--color-nav-item-text)]'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </button>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return button;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* About & Settings */}
      <div className="px-2 pb-4 pt-2 space-y-0.5">
        {(() => {
          const isAboutActive = activeModule === 'about';
          const aboutBtn = (
            <button
              onClick={() => onModuleChange('about')}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isAboutActive
                  ? 'glass-item text-[var(--color-nav-item-text-active)]'
                  : 'glass-item-subtle text-[var(--color-nav-item-text)]'
              )}
            >
              <Info className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>About</span>}
            </button>
          );
          return collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{aboutBtn}</TooltipTrigger>
              <TooltipContent side="right">About</TooltipContent>
            </Tooltip>
          ) : aboutBtn;
        })()}
        {(() => {
          const isActive = activeModule === 'settings';
          const btn = (
            <button
              onClick={() => onModuleChange('settings')}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'glass-item text-[var(--color-nav-item-text-active)]'
                  : 'glass-item-subtle text-[var(--color-nav-item-text)]'
              )}
            >
              <Settings className="h-4.5 w-4.5 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </button>
          );
          return collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{btn}</TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : btn;
        })()}
      </div>
    </aside>
  );
}
