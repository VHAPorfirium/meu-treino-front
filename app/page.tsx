'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { roleHome } from '@/lib/auth/storage';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? roleHome(user.role) : '/login');
  }, [user, loading, router]);

  return (
    <div className="app-shell items-center justify-center">
      <p className="text-muted2">Carregando…</p>
    </div>
  );
}
