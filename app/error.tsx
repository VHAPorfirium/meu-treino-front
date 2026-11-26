'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/** Boundary global de erros inesperados (evita tela branca do Next). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro inesperado na interface:', error);
  }, [error]);

  return (
    <div className="app-shell safe-top safe-bottom items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-soft">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-3 font-display text-[22px] font-extrabold text-ink">
          Algo saiu do esperado
        </h1>
        <p className="mt-1.5 text-sm font-semibold text-muted">
          Tente recarregar esta tela. Se o problema continuar, volte para o início.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-2xl bg-brand py-3 text-sm font-extrabold text-white shadow-brand transition active:scale-[0.98]"
          >
            Tentar novamente
          </button>
          <Link
            href="/"
            className="block w-full rounded-2xl bg-chip py-3 text-sm font-extrabold text-ink transition active:scale-[0.98]"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
