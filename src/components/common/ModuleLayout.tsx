import type { ReactNode } from 'react';

/**
 * Two-column module layout: inputs on the left, calculation breakdown on the right.
 * On smaller screens, stacks vertically with breakdown below.
 */
export function ModuleLayout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="space-y-6 w-full max-w-3xl flex-1 min-w-0">
        {children}
      </div>
      {sidebar && (
        <div className="w-full lg:w-80 lg:shrink-0 lg:sticky lg:top-0">
          {sidebar}
        </div>
      )}
    </div>
  );
}
