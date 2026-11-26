'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RequireRole } from '@/lib/auth/require-role';
import { BottomNav } from '@/components/layout/bottom-nav';

const TRAINEE_NAVIGATION_ITEMS = [
  { href: '/treino', label: 'Hoje', icon: '🏋️' },
  { href: '/treino/meus', label: 'Treinos', icon: '📋', alsoActiveFor: ['/treino/historico'] },
  { href: '/treino/conquistas', label: 'Conquistas', icon: '🏆' },
  { href: '/treino/recados', label: 'Recados', icon: '📝' },
  { href: '/treino/fotos', label: 'Fotos', icon: '📷' },
];

export default function TraineeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // durante a execução do treino o menu some (modo foco)
  const isInWorkoutSession = pathname.startsWith('/treino/sessao/');

  return (
    <RequireRole role="TRAINEE">
      <div className="app-shell">
        <main className="min-w-0 flex-1">{children}</main>
        {!isInWorkoutSession && <BottomNav items={TRAINEE_NAVIGATION_ITEMS} />}
      </div>
    </RequireRole>
  );
}
