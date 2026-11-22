'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

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

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-6 bg-inverse p-6 text-on-inverse md:flex">
        <div className="font-display text-[20px] font-extrabold tracking-[0.16em] text-brand">
          RITMO
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
          <div className="flex-1">
            <p className="text-[13px] font-bold">{user?.name ?? 'Admin'}</p>
            <p className="text-[11px] text-on-inverse-muted">Personal</p>
          </div>
          <button onClick={logout} className="text-xs font-bold text-on-inverse-muted hover:text-on-inverse">
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="safe-top sticky top-0 z-30 bg-inverse px-4 pb-3.5 pt-2 text-on-inverse shadow-md md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-[17px] font-extrabold tracking-[0.16em] text-brand">
            RITMO
          </div>
          <button
            onClick={logout}
            className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-on-inverse transition active:scale-95"
          >
            Sair
          </button>
        </div>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
                  active ? 'bg-brand text-white' : 'bg-white/10 text-on-inverse/80'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
