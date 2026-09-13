'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Role } from '../types';
import { useAuth } from './auth-context';
import { roleHome } from './storage';

// Guard client-side: garante que o usuário tem o papel esperado.
// A autorização real é enforçada pelo backend; aqui é só UX de navegação.
export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role !== role) router.replace(roleHome(user.role));
  }, [user, loading, role, router]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="app-shell items-center justify-center">
        <p className="text-muted2">Carregando…</p>
      </div>
    );
  }
  return <>{children}</>;
}
