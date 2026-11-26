'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '@/lib/auth/require-role';

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  return <RequireRole role="ADMIN">{children}</RequireRole>;
}
