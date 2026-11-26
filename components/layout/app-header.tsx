'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { triggerHaptic } from '@/lib/haptics';
import { applyThemePreference, readInitialIsDark } from '@/lib/theme';

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
    const dark = readInitialIsDark();
    setIsDark(dark);
  }, []);

  function toggleTheme() {
    triggerHaptic('light');
    const willBeDark = !isDark;
    setIsDark(willBeDark);
    applyThemePreference(willBeDark);
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
