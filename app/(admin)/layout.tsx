'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '@/lib/auth/require-role';
import { Sidebar } from '@/components/layout/sidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="ADMIN">
      <div className="min-h-screen bg-sand md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </RequireRole>
  );
}
