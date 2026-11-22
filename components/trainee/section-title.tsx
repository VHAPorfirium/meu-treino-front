import type { ReactNode } from 'react';

/** Título de seção em caixa alta, com ação opcional à direita. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-0.5 mb-2 mt-1 flex items-baseline justify-between gap-2">
      <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-muted2">{children}</p>
      {action}
    </div>
  );
}
