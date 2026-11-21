'use client';

import type { ButtonHTMLAttributes } from 'react';
import { triggerHaptic } from '@/lib/haptics';

type Variant =
  | 'primary'
  | 'secondary'
  | 'done'
  | 'skip'
  | 'replace'
  | 'ghost';

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-brand hover:bg-brand-700',
  secondary: 'bg-card text-ink border-2 border-line hover:bg-chip',
  done: 'bg-done text-on-done hover:brightness-95 shadow-sm',
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
  onClick,
  ...props
}: Props) {
  return (
    <button
      {...props}
      onClick={(e) => {
        triggerHaptic('light');
        onClick?.(e);
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[16px] font-extrabold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 select-none ${styles[variant]} ${active ? 'ring-2 ring-offset-2 ring-offset-paper ring-brand' : ''} ${className}`}
    />
  );
}
