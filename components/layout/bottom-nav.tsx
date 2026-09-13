'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav({
  items,
}: {
  items: { href: string; label: string; icon: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom sticky bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
      <div className="flex">
        {items.map((it) => {
          const active =
            pathname === it.href ||
            (it.href !== '/' && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-bold ${
                active ? 'text-brand' : 'text-muted2'
              }`}
            >
              <span className="text-lg">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
