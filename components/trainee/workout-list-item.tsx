import Link from 'next/link';
import type { ReactNode } from 'react';

/** Linha de treino: letra, nome, detalhe e um selo à direita. Toque abre o treino. */
export function WorkoutListItem({
  href,
  letter,
  title,
  subtitle,
  badge,
}: {
  href: string;
  letter: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 transition active:scale-[.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip font-display text-base font-extrabold text-ink">
        {letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-extrabold text-ink">{title}</span>
        {subtitle && <span className="block truncate text-xs font-bold text-muted2">{subtitle}</span>}
      </span>
      {badge}
    </Link>
  );
}

const PILL_STYLES = {
  brand: 'bg-brand text-white',
  done: 'bg-done-bg text-done',
  skip: 'bg-skip-bg text-skip',
  replace: 'bg-replace-bg text-replace',
  gold: 'bg-gold-bg text-gold',
  neutral: 'bg-chip text-muted',
} as const;

export type PillTone = keyof typeof PILL_STYLES;

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${PILL_STYLES[tone]}`}>
      {children}
    </span>
  );
}
