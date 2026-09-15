'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Exercise } from '@/lib/types';
import { exercisesApi } from '@/lib/api/endpoints';
import {
  equipamentoExercicio,
  musculoExercicio,
  nomeExercicio,
} from '@/lib/exercicios/modo';

const STRIPE = 'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

/**
 * E12 — ver o GIF do exercício na hora de montar o treino.
 *
 * É **opcional**: quem não quer ver segue o fluxo de sempre, sem clique a mais.
 * Por isso o GIF só é carregado quando este componente monta — pré-carregar os
 * 24 GIFs de uma página mataria o 3G da academia. A lista continua mostrando a
 * miniatura estática.
 *
 * As instruções costumam vir só na rota de detalhe, então buscamos o exercício
 * completo aqui; enquanto não chega, já mostramos o que a lista tinha.
 */
export function GifModal({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const [completo, setCompleto] = useState<Exercise>(exercise);

  useEffect(() => {
    let cancelado = false;
    exercisesApi
      .get(exercise.id)
      .then((e) => !cancelado && setCompleto(e))
      .catch(() => {
        /* fica com o que já tinha — o GIF é o que importa */
      });
    return () => {
      cancelado = true;
    };
  }, [exercise.id]);

  // fechar com Esc é o reflexo de quem usa teclado (o admin é desktop)
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const midia = completo.gifUrl ?? completo.thumbnailUrl;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-paper p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-extrabold capitalize leading-tight">
              {nomeExercicio(completo)}
            </h3>
            <p className="mt-0.5 text-xs font-semibold capitalize text-muted2">
              {musculoExercicio(completo)} · {equipamentoExercicio(completo)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted"
          >
            Fechar
          </button>
        </div>

        {midia ? (
          <Image
            src={midia}
            alt={nomeExercicio(completo)}
            width={420}
            height={420}
            className="w-full rounded-2xl bg-white object-contain"
            unoptimized
            priority
          />
        ) : (
          <div className="h-56 w-full rounded-2xl" style={{ background: STRIPE }} />
        )}

        {completo.instructions && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink2">
            {completo.instructions}
          </p>
        )}
        {!completo.instructions && completo.instructionsEn && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted2">
            {completo.instructionsEn}
          </p>
        )}
      </div>
    </div>
  );
}
