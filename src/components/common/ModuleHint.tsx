import { X, Lightbulb } from 'lucide-react';
import { useStore } from '@/store';

interface ModuleHintProps {
  /** Unique id for this hint — used to track dismissal */
  id: string;
  /** The help text to display */
  children: React.ReactNode;
}

/**
 * A small, dismissible contextual tip displayed at the top of a module page.
 * Once dismissed, it won't appear again (persisted in settings.dismissedHints).
 */
export function ModuleHint({ id, children }: ModuleHintProps) {
  const dismissed = useStore((s) => s.settings.dismissedHints ?? []);
  const updateSettings = useStore((s) => s.updateSettings);

  if (dismissed.includes(id)) return null;

  const handleDismiss = () => {
    updateSettings({ dismissedHints: [...dismissed, id] });
  };

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--color-accent-primary)]/5 border border-[var(--color-accent-primary)]/10 text-sm">
      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent-primary)]" />
      <div className="flex-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {children}
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-[var(--color-accent-primary)]/10 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        title="Dismiss hint"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
