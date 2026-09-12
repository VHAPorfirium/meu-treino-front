'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'done'
  | 'skip'
  | 'replace'
  | 'ghost';

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-brand hover:bg-brand-700',
  secondary: 'bg-card text-ink border-2 border-ink hover:bg-chip',
  done: 'bg-done text-white hover:brightness-95',
  skip: 'bg-card text-skip border-2 border-skip hover:bg-skip-bg',
  replace: 'bg-card text-replace border-2 border-replace hover:bg-replace-bg',
  ghost: 'text-muted hover:bg-chip',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
}

export function Button({
  variant = 'primary',
  active,
  className = '',
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[16px] font-extrabold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${active ? 'ring-2 ring-offset-2 ring-offset-paper ring-ink/30' : ''} ${className}`}
    />
  );
}
