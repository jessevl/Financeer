import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from '@/components/common/FormFields';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GlobalSettings } from '@/types';

const accentColors: { value: GlobalSettings['accentColor']; label: string; swatch: string }[] = [
  { value: 'default', label: 'Default', swatch: 'bg-[var(--color-stone-600)]' },
  { value: 'coral', label: 'Coral', swatch: 'bg-[#E8705F]' },
  { value: 'honey', label: 'Honey', swatch: 'bg-[#F59E0B]' },
  { value: 'blue', label: 'Blue', swatch: 'bg-blue-500' },
  { value: 'green', label: 'Green', swatch: 'bg-green-500' },
  { value: 'red', label: 'Red', swatch: 'bg-red-500' },
  { value: 'purple', label: 'Purple', swatch: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', swatch: 'bg-pink-500' },
  { value: 'teal', label: 'Teal', swatch: 'bg-teal-500' },
  { value: 'stone', label: 'Stone', swatch: 'bg-stone-500' },
];

export function SettingsModule() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const update = (changes: Partial<GlobalSettings>) => {
    updateSettings(changes);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-[var(--color-text-secondary)] mt-1">Theme and appearance preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field label="Theme" className="max-w-xs">
            <Select value={settings.theme} onValueChange={(v) => update({ theme: v as GlobalSettings['theme'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Theme Variant" className="max-w-xs">
            <Select value={settings.themeVariant} onValueChange={(v) => update({ themeVariant: v as GlobalSettings['themeVariant'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">Warm (Stone)</SelectItem>
                <SelectItem value="cool">Cool (Blue/Gray)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div>
            <label className="text-sm font-medium mb-3 block">Accent Color</label>
            <div className="flex flex-wrap gap-2">
              {accentColors.map(({ value, label, swatch }) => (
                <button
                  key={value}
                  onClick={() => update({ accentColor: value })}
                  className={cn(
                    'relative h-8 w-8 rounded-full transition-all',
                    swatch,
                    settings.accentColor === value
                      ? 'ring-2 ring-[var(--color-border-focus)] ring-offset-2 ring-offset-[var(--color-surface-primary)] scale-110'
                      : 'hover:scale-105'
                  )}
                  title={label}
                >
                  {settings.accentColor === value && (
                    <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
