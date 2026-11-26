import type { ReactNode } from 'react';

export function PageHead({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-paper px-4 py-5 sm:px-6 sm:py-6 md:px-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[13px] font-bold text-muted2">{eyebrow}</p>
        )}
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-[28px] md:text-[36px]">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
