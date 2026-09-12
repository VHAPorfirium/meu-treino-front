'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline não é crítico no MVP */
      });
    }
  }, []);
  return null;
}
