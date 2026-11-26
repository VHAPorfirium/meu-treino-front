'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { applyThemePreference, readInitialIsDark } from '@/lib/theme';

/** Menu agrupado: o dia a dia, a montagem dos treinos e o acompanhamento. */
const NAVIGATION_GROUPS = [
  { title: 'Hoje', links: [{ href: '/dashboard', label: 'Dashboard', icon: '📊' }] },
  {
    title: 'Programação',
    links: [
      { href: '/dashboard/treinos', label: 'Treinos', icon: '📋' },
      { href: '/dashboard/programas', label: 'Programas', icon: '🎯' },
      { href: '/dashboard/exercicios', label: 'Catálogo', icon: '💪' },
    ],
  },
  {
    title: 'Acompanhamento',
    links: [
      { href: '/dashboard/alunos', label: 'Alunos', icon: '🧑‍🤝‍🧑' },
      { href: '/dashboard/historico', label: 'Histórico', icon: '🗓️' },
      { href: '/dashboard/evolucao', label: 'Evolução', icon: '📈' },
    ],
  },
];

const NAV = NAVIGATION_GROUPS.flatMap((navigationGroup) => navigationGroup.links);

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(readInitialIsDark());
  }, []);

  function toggleTheme() {
    const willBeDark = !isDark;
    setIsDark(willBeDark);
    applyThemePreference(willBeDark);
  }

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-6 bg-inverse p-6 text-on-inverse md:flex">
        <div className="flex items-center justify-between">
          <div className="font-display text-[20px] font-extrabold tracking-[0.16em] text-brand">
            RITMO
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar modo escuro"
            title="Alternar modo claro / escuro"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm transition active:scale-90"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAVIGATION_GROUPS.map((navigationGroup) => (
            <div key={navigationGroup.title} className="mb-2 flex flex-col gap-1">
              <p className="mx-3.5 mb-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-on-inverse-muted">
                {navigationGroup.title}
              </p>
              {navigationGroup.links.map((n) => {
                const active = isActive(pathname, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                      active ? 'bg-brand text-white' : 'text-on-inverse/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="opacity-90">{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">
            {(user?.name ?? 'A').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold">{user?.name ?? 'Admin'}</p>
            <p className="text-[11px] text-on-inverse-muted">Personal</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs font-bold text-on-inverse-muted hover:text-on-inverse"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="safe-top sticky top-0 z-30 w-full max-w-full bg-inverse px-4 pb-3 text-on-inverse shadow-md md:hidden">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="font-display text-[17px] font-extrabold tracking-[0.16em] text-brand">
            RITMO
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar modo escuro"
              title="Alternar modo claro / escuro"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm transition active:scale-90"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-on-inverse transition active:scale-95"
            >
              Sair
            </button>
          </div>
        </div>
        <nav aria-label="Navegação do painel" className="flex flex-wrap gap-1.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 ${
                  active ? 'bg-brand text-white' : 'bg-white/10 text-on-inverse/80'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
