'use client';

import { useAuth } from '@/lib/auth/auth-context';

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
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line bg-paper/95 px-5 py-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[13px] font-bold text-muted2">{eyebrow}</p>
          )}
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted2">{subtitle}</p>}
        </div>
        <button
          onClick={logout}
          className="shrink-0 rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
