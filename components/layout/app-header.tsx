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
  const { logout } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('theme_preference');
    } catch {
      /* Safari privado / restrição de storage */
    }
    const isSavedDark = saved === 'dark';
    const isSavedLight = saved === 'light';
    const isSystemDark =
      !saved && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isSavedDark || isSystemDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      setIsDark(true);
    } else if (isSavedLight) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      setIsDark(false);
    }
  }, []);

  function toggleTheme() {
    triggerHaptic('light');
    const willBeDark = !isDark;
    setIsDark(willBeDark);
    if (willBeDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    try {
      localStorage.setItem('theme_preference', willBeDark ? 'dark' : 'light');
    } catch {
      /* ignora falha de storage */
    }
  }

  return (
    <header className="safe-top sticky top-0 z-20 w-full border-b border-line bg-paper/95 px-4 pb-3.5 backdrop-blur sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="truncate text-[11.5px] font-bold uppercase tracking-wider text-muted2">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate font-display text-[22px] font-extrabold leading-tight tracking-tight text-ink sm:text-[24px]">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted2">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar modo escuro"
            title="Alternar modo claro / escuro para academia"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-sm text-ink transition active:scale-90"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
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
