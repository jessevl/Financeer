import { useStore, useActiveScenario } from '@/store';
import { useUndoRedoStore } from '@/store/undoRedo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Pencil,
  Undo2,
  Redo2,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { useState, useRef } from 'react';

interface TopBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onMobileMenuToggle: () => void;
}

export function TopBar({ sidebarCollapsed, onToggleSidebar, onMobileMenuToggle }: TopBarProps) {
  const store = useStore();
  const activeScenario = useActiveScenario();
  const canUndo = useUndoRedoStore((s) => s.canUndo);
  const canRedo = useUndoRedoStore((s) => s.canRedo);
  const undo = useUndoRedoStore((s) => s.undo);
  const redo = useUndoRedoStore((s) => s.redo);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = {
      schemaVersion: store.schemaVersion,
      scenarios: store.scenarios,
      settings: store.settings,
      activeScenarioId: store.activeScenarioId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        // Validate schema before importing
        const { validateImport } = await import('@/lib/importSchema');
        const result = validateImport(raw);
        if (!result.success) {
          alert('Import validation failed:\n\n' + result.errors.join('\n'));
          return;
        }
        const data = result.data;
        if (data.scenarios && data.settings) {
          store.importData({
            scenarios: data.scenarios as any,
            settings: data.settings as any,
            activeScenarioId: data.activeScenarioId || data.scenarios[0]?.id,
          });
        }
      } catch {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRename = () => {
    if (renameValue.trim()) {
      store.renameScenario(activeScenario.id, renameValue.trim());
    }
    setRenameOpen(false);
  };

  const storageSize = (() => {
    try {
      const data = localStorage.getItem('financeer-storage');
      return data ? (new Blob([data]).size / 1024).toFixed(1) : '0';
    } catch {
      return '?';
    }
  })();

  return (
    <>
      <header className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 md:py-3 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Glass pill: sidebar toggle + scenario picker */}
          <div className="glass-panel-nav flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1.5">
            {/* Sidebar / mobile menu toggle — single button, adapts to viewport */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  onMobileMenuToggle();
                } else {
                  onToggleSidebar();
                }
              }}
              className="glass-button h-7 w-7 shrink-0"
            >
              <Menu className="h-3.5 w-3.5 md:hidden" />
              {sidebarCollapsed
                ? <PanelLeftOpen className="h-3.5 w-3.5 hidden md:block" />
                : <PanelLeftClose className="h-3.5 w-3.5 hidden md:block" />
              }
            </button>

            <Select value={activeScenario.id} onValueChange={store.setActiveScenario}>
              <SelectTrigger className="w-28 sm:w-36 md:w-44 h-7 border-0 bg-transparent shadow-none text-sm font-medium text-[var(--color-text-primary)] focus:ring-0">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                {store.scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => store.createScenario()}
              className="glass-button h-7 w-7 shrink-0"
              title="New scenario"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:inline text-xs text-[var(--color-text-tertiary)]">
            Saved · {storageSize} KB
          </span>

          {/* Privacy indicator */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-600/70 dark:text-emerald-400/60">
            <ShieldCheck className="h-3 w-3" />
            <span>Offline · Private</span>
          </div>

          {/* Undo / Redo */}
          <div className="glass-panel-nav flex items-center px-1 py-1 gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="glass-button h-7 w-7 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="glass-button h-7 w-7 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Glass pill: actions menu */}
          <div className="glass-panel-nav flex items-center px-1 py-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="glass-button h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setRenameValue(activeScenario.name); setRenameOpen(true); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename scenario
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => store.duplicateScenario(activeScenario.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate scenario
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => store.deleteScenario(activeScenario.id)}
                  disabled={store.scenarios.length <= 1}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete scenario
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export all data
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import data
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setResetOpen(true)} className="text-destructive">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset all data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Scenario</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            placeholder="Scenario name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset All Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all your scenarios and settings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { store.resetAll(); setResetOpen(false); }}>
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
