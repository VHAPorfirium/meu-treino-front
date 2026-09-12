'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/treinos', label: 'Treinos', icon: '📋' },
  { href: '/dashboard/exercicios', label: 'Catálogo', icon: '💪' },
  { href: '/dashboard/historico', label: 'Histórico', icon: '🗓️' },
  { href: '/dashboard/evolucao', label: 'Evolução', icon: '📈' },
];

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
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-8 bg-ink p-6 text-paper md:flex">
        <div className="font-display text-[20px] font-extrabold tracking-[0.16em] text-brand">
          RITMO
        </div>
        <nav className="flex flex-col gap-1.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
                  active
                    ? 'bg-brand text-white'
                    : 'text-paper/80 hover:bg-white/5'
                }`}
              >
                <span className="opacity-90">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-ink2 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">
            {(user?.name ?? 'A').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold">{user?.name ?? 'Admin'}</p>
            <p className="text-[11px] text-faint">Admin</p>
          </div>
          <button onClick={logout} className="text-xs font-bold text-faint hover:text-paper">
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 bg-ink px-4 py-3 text-paper md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-[17px] font-extrabold tracking-[0.16em] text-brand">
            RITMO
          </div>
          <button onClick={logout} className="text-xs font-bold text-faint">
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
                  active ? 'bg-brand text-white' : 'bg-white/10 text-paper/80'
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
