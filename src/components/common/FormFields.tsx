import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, RotateCcw } from 'lucide-react';

interface FieldProps {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, tooltip, children, className }: FieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}

export function CurrencyInput({ value, onChange, placeholder, className }: CurrencyInputProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
      <Input
        type="number"
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder}
        className={`pl-7 ${className || ''}`}
        step="any"
      />
    </div>
  );
}

interface PercentInputProps {
  value: number; // stored as decimal (0.07 = 7%)
  onChange: (value: number) => void;
  placeholder?: string;
}

export function PercentInput({ value, onChange, placeholder }: PercentInputProps) {
  return (
    <div className="relative">
      <Input
        type="number"
        value={value !== undefined && value !== null ? (value * 100).toFixed(2) : ''}
        onChange={(e) => onChange(parseFloat(e.target.value) / 100 || 0)}
        placeholder={placeholder}
        className="pr-7"
        step="0.1"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
    </div>
  );
}

interface PresetFieldProps extends FieldProps {
  /** The preset value to compare against */
  presetValue?: number | null;
  /** The current value */
  currentValue?: number | null;
  /** Called when the user clicks "restore preset" */
  onRestore?: () => void;
  /** Format for displaying the preset value */
  format?: 'currency' | 'percent';
}

/**
 * A Field wrapper that visually indicates when the current value differs from
 * the preset value, and provides a one-click restore button.
 */
export function PresetField({
  presetValue,
  currentValue,
  onRestore,
  format,
  label,
  tooltip,
  children,
  className,
}: PresetFieldProps) {
  const isOverridden =
    presetValue !== undefined &&
    currentValue !== undefined &&
    presetValue !== currentValue;

  const fmtPreset = () => {
    if (presetValue === null || presetValue === undefined) return '∞';
    if (format === 'percent') return `${(presetValue * 100).toFixed(2)}%`;
    if (format === 'currency') return `€${Math.round(presetValue).toLocaleString('nl-NL')}`;
    return String(presetValue);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Label className={`text-sm font-medium ${isOverridden ? 'text-amber-600' : ''}`}>{label}</Label>
        {isOverridden && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onRestore}
                className="inline-flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                restore
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Preset: {fmtPreset()} — click to restore
            </TooltipContent>
          </Tooltip>
        )}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className={isOverridden ? 'ring-1 ring-amber-300/50 rounded-md' : ''}>
        {children}
      </div>
    </div>
  );
}
