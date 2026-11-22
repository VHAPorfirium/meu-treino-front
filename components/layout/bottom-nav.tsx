'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { triggerHaptic } from '@/lib/haptics';

export function BottomNav({
  items,
}: {
  /** `alsoActiveFor`: outras rotas que acendem este item (ex.: histórico → Treinos). */
  items: { href: string; label: string; icon: string; alsoActiveFor?: string[] }[];
}) {
  const pathname = usePathname();

  // ativo = item cujo href (ou rota extra) é o prefixo MAIS LONGO da rota atual
  const matchesRoute = (route: string) => pathname === route || pathname.startsWith(route + '/');
  const activeHref = items
    .map((it) => ({
      href: it.href,
      matchedLength: Math.max(
        ...[it.href, ...(it.alsoActiveFor ?? [])].map((route) => (matchesRoute(route) ? route.length : -1)),
      ),
    }))
    .filter((candidate) => candidate.matchedLength >= 0)
    .sort((a, b) => b.matchedLength - a.matchedLength)[0]?.href;

  return (
    <nav className="safe-bottom sticky bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur transition-colors">
      <div className="flex">
        {items.map((it) => {
          const active = it.href === activeHref;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => triggerHaptic('light')}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-extrabold transition active:scale-95 ${
                active ? 'text-brand' : 'text-muted2'
              }`}
            >
              <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>
                {it.icon}
              </span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
