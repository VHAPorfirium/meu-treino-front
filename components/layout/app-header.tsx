'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel } from '@/lib/auth/storage';
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
  const { linkedProfiles, switchProfile, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

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

  async function handleSwitch(targetRole: (typeof linkedProfiles)[number]['role']) {
    if (switching) return;
    triggerHaptic('light');
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchProfile(targetRole);
    } catch (err) {
      triggerHaptic('warning');
      setSwitchError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível alternar o perfil agora.',
      );
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header className="safe-top sticky top-0 z-20 w-full border-b border-line bg-paper/95 px-4 pb-3.5 backdrop-blur sm:px-5">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="truncate text-[11.5px] font-bold uppercase tracking-wider text-muted2">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate font-display text-[20px] font-extrabold leading-tight tracking-tight text-ink sm:text-[24px]">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted2">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {linkedProfiles.map((p) => (
            <button
              key={p.role}
              type="button"
              disabled={switching}
              onClick={() => void handleSwitch(p.role)}
              title={`Alternar para ${roleLabel(p.role)} (@${p.username})`}
              className="rounded-full bg-brand/10 px-2.5 py-1.5 text-[11px] font-extrabold text-brand-ink transition active:scale-95 disabled:opacity-50 sm:px-3 sm:text-xs"
            >
              ⇄ {roleLabel(p.role)}
            </button>
          ))}
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
              void logout();
            }}
            className="rounded-full bg-chip px-2.5 py-1.5 text-xs font-bold text-muted transition active:scale-95 sm:px-3"
          >
            Sair
          </button>
        </div>
      </div>

      {switchError && (
        <div
          role="alert"
          className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand-ink"
        >
          <span>{switchError}</span>
          <button
            type="button"
            onClick={() => setSwitchError(null)}
            className="shrink-0 font-extrabold underline"
          >
            fechar
          </button>
        </div>
      )}
    </header>
  );
}
