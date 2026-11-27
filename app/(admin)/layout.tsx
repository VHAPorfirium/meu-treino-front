'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '@/lib/auth/require-role';
import { Sidebar } from '@/components/layout/sidebar';

export default function PersonalDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="PERSONAL">
      <div className="min-h-screen w-full max-w-full overflow-x-clip bg-sand md:flex">
        <Sidebar />
        <main className="safe-bottom min-w-0 w-full flex-1">{children}</main>
      </div>
    </RequireRole>
  );
}
