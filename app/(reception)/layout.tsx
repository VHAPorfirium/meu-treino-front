'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '@/lib/auth/require-role';

export default function ReceptionLayout({ children }: { children: ReactNode }) {
  return <RequireRole role="RECEPTION">{children}</RequireRole>;
}
