import type { ReactNode } from 'react';
import { formatCurrency, formatPercent } from '@/lib/format';

// ---- Primitive building blocks for the receipt-style panel ----

export function CalcLine({
  label,
  value,
  indent = 0,
  bold = false,
  dimmed = false,
  accent = false,
  separator = false,
}: {
  label: string;
  value?: string;
  indent?: number;
  bold?: boolean;
  dimmed?: boolean;
  accent?: boolean;
  separator?: boolean;
}) {
  if (separator) {
    return <div className="border-b border-dashed border-current/20 my-1.5" />;
  }
  return (
    <div
      className={`flex justify-between gap-3 ${bold ? 'font-bold' : ''} ${dimmed ? 'opacity-50' : ''} ${accent ? 'text-[var(--color-accent-primary)]' : ''}`}
      style={{ paddingLeft: `${indent * 12}px` }}
    >
      <span className="truncate">{label}</span>
      {value !== undefined && <span className="tabular-nums shrink-0 text-right">{value}</span>}
    </div>
  );
}

export function CalcSeparator() {
  return <div className="border-b border-dashed border-current/20 my-1.5" />;
}

export function CalcHeader({ children }: { children: ReactNode }) {
  return (
    <div className="font-bold text-xs uppercase tracking-widest mb-2 opacity-70">
      {children}
    </div>
  );
}

export function CalcNote({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] leading-tight opacity-50 mt-1">
      {children}
    </div>
  );
}

export function CalcSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      {title && <CalcHeader>{title}</CalcHeader>}
      {children}
    </div>
  );
}

/**
 * Receipt-style calculation breakdown panel.
 * Uses monospace font and subtle styling to be visually distinct from form inputs.
 */
export function CalculationPanel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-muted/40 dark:bg-muted/20 border border-border/50 rounded-lg">
      {title && (
        <div className="px-4 pt-3 pb-2 border-b border-dashed border-border/50">
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest opacity-70">
            {title}
          </h3>
        </div>
      )}
      <div className="px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/80 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

// ---- Convenience formatters ----

export function cur(v: number): string {
  return formatCurrency(v);
}

export function pct(v: number): string {
  return formatPercent(v);
}

export function num(v: number, decimals = 0): string {
  return v.toLocaleString('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
