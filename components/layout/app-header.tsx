'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { triggerHaptic } from '@/lib/haptics';

export function AppHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isSavedDark = localStorage.getItem('theme_preference') === 'dark';
    const isSystemDark =
      !localStorage.getItem('theme_preference') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isSavedDark || isSystemDark) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  function toggleTheme() {
    triggerHaptic('light');
    const willBeDark = !isDark;
    setIsDark(willBeDark);
    if (willBeDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme_preference', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme_preference', 'light');
    }
  }

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line bg-paper/95 px-5 py-3.5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted2">{eyebrow}</p>
          )}
          <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-muted2 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label="Alternar modo escuro"
            title="Alternar modo claro / escuro para academia"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-sm text-ink transition active:scale-90"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              logout();
            }}
            className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted transition active:scale-95"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
