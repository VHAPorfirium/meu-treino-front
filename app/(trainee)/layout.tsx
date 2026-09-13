'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '@/lib/auth/require-role';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function TraineeLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="TRAINEE">
      <div className="app-shell">
        <main className="flex-1">{children}</main>
        <BottomNav
          items={[
            { href: '/treino', label: 'Treino', icon: '🏋️' },
            { href: '/treino/historico', label: 'Histórico', icon: '📅' },
          ]}
        />
      </div>
    </RequireRole>
  );
}
