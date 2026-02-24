import { useStore, useActiveScenario } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, CurrencyInput } from '@/components/common/FormFields';
import { ModuleHint } from '@/components/common/ModuleHint';
import { Plus, Trash2, Calendar, Briefcase, Home, Baby, Gift, Coffee, Users, Zap, Edit } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { LifeEvent, LifeEventType } from '@/types';

const eventTypeConfig: Record<LifeEventType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  salary_change: { label: 'Salary Change', icon: Briefcase, color: 'text-blue-500' },
  buy_property: { label: 'Buy Property', icon: Home, color: 'text-green-500' },
  sell_property: { label: 'Sell Property', icon: Home, color: 'text-emerald-500' },
  child_born: { label: 'Child Born', icon: Baby, color: 'text-pink-500' },
  inheritance: { label: 'Inheritance', icon: Gift, color: 'text-amber-500' },
  career_break: { label: 'Career Break', icon: Coffee, color: 'text-orange-500' },
  partner_change: { label: 'Partner Change', icon: Users, color: 'text-purple-500' },
  lump_sum: { label: 'Lump Sum', icon: Zap, color: 'text-cyan-500' },
  custom: { label: 'Custom Event', icon: Edit, color: 'text-gray-500' },
};

export function LifeEventsModule() {
  const scenario = useActiveScenario();
  const updateLifeEvents = useStore((s) => s.updateLifeEvents);
  const events = scenario.lifeEvents;

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  const addEvent = () => {
    const newEvent: LifeEvent = {
      id: uuidv4(),
      type: 'custom',
      date: '',
      label: '',
      amount: 0,
    };
    updateLifeEvents(scenario.id, [...events, newEvent]);
  };

  const updateEvent = (id: string, changes: Partial<LifeEvent>) => {
    updateLifeEvents(scenario.id, events.map((e) => e.id === id ? { ...e, ...changes } : e));
  };

  const removeEvent = (id: string) => {
    updateLifeEvents(scenario.id, events.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Life Events</h2>
          <p className="text-muted-foreground mt-1">Plan future events that will affect your finances.</p>
        </div>
        <Button onClick={addEvent}>
          <Plus className="h-4 w-4 mr-2" /> Add Event
        </Button>
      </div>

      <ModuleHint id="events">
        Life events alter your simulation from a specific date onward. Add salary changes, property purchases, children, inheritances, or career breaks. Each event adjusts the relevant numbers in that year and all following years.
      </ModuleHint>

      {sortedEvents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No life events planned</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Add events like career changes, property purchases, or inheritance to see their impact on your plan.
            </p>
            <Button onClick={addEvent}>
              <Plus className="h-4 w-4 mr-2" /> Add Event
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {sortedEvents.map((event) => {
          const config = eventTypeConfig[event.type];
          const Icon = config.icon;

          return (
            <Card key={event.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 p-2 rounded-lg bg-muted ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Field label="Type">
                        <Select value={event.type} onValueChange={(v) => updateEvent(event.id, { type: v as LifeEventType })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(eventTypeConfig).map(([type, cfg]) => (
                              <SelectItem key={type} value={type}>{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Date">
                        <Input type="month" value={event.date} onChange={(e) => updateEvent(event.id, { date: e.target.value })} />
                      </Field>
                      <Field label="Financial Impact">
                        <CurrencyInput value={event.amount} onChange={(v) => updateEvent(event.id, { amount: v })} />
                      </Field>
                    </div>

                    <div className="flex items-end gap-3">
                      <Field label="Label" className="flex-1">
                        <Input
                          value={event.label}
                          onChange={(e) => updateEvent(event.id, { label: e.target.value })}
                          placeholder="Short name for this event"
                        />
                      </Field>
                      {event.type === 'career_break' && (
                        <Field label="Duration (months)" className="w-36">
                          <Input
                            type="number"
                            value={event.durationMonths || ''}
                            onChange={(e) => updateEvent(event.id, { durationMonths: parseInt(e.target.value) || 0 })}
                          />
                        </Field>
                      )}
                    </div>
                    <Field label="Description" className="w-full">
                      <Input
                        value={event.description ?? ''}
                        onChange={(e) => updateEvent(event.id, { description: e.target.value })}
                        placeholder="Optional notes or details..."
                      />
                    </Field>
                  </div>

                  <Button variant="ghost" size="icon" className="mt-6 shrink-0" onClick={() => removeEvent(event.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
