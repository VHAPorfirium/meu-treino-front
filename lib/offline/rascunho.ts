'use client';

import { getUser } from '../auth/storage';
import { db, STORE_RASCUNHO } from './queue';

/**
 * E13 — rascunho da sessão em andamento.
 *
 * O problema que isto resolve: a Ninfa está treinando, vai no WhatsApp ou troca
 * de música, e o iOS **mata o PWA**. Ao voltar, a página remonta do zero.
 *
 * O que já sobrevivia sozinho: a sessão e as marcações (vivem no servidor) e a
 * fila offline (IndexedDB). O que morria era estado de tela — e era justamente o
 * que mais incomodava:
 *   1. o **timer de descanso**, que ficava só em `useState`;
 *   2. o que foi **digitado e ainda não salvo** (peso/reps só iam pro servidor no
 *      `onBlur`, então um número com o teclado ainda aberto se perdia).
 *
 * Aqui guardamos os dois. É rascunho local, não fonte da verdade: o servidor
 * continua mandando no que foi marcado. Por isso o rascunho é descartado assim
 * que a sessão é finalizada, e ignorado se for de outra sessão ou de outro usuário.
 */

const CHAVE = 'atual'; // só existe UMA sessão em andamento por vez

export interface LinhaSerie {
  weight: string;
  reps: string;
}

export interface RascunhoExercicio {
  linhas?: LinhaSerie[];
  minutos?: string;
  nota?: string;
}

export interface RascunhoSessao {
  id: typeof CHAVE;
  workoutLogId: string;
  userId?: string;
  atualizadoEm: number;
  exercicios: Record<string, RascunhoExercicio>;
  /** instante absoluto (epoch ms) em que o descanso termina — não "segundos restantes" */
  timerTerminaEm?: number | null;
  timerRotulo?: string | null;
}

function vazio(workoutLogId: string, userId?: string): RascunhoSessao {
  return {
    id: CHAVE,
    workoutLogId,
    userId,
    atualizadoEm: Date.now(),
    exercicios: {},
  };
}

/** Fila serializada para evitar corridas read-modify-write no IndexedDB. */
let filaOperacoes: Promise<void> = Promise.resolve();

function enfileirar(operacao: () => Promise<void>): Promise<void> {
  const proxima = filaOperacoes.then(operacao, operacao);
  filaOperacoes = proxima.catch(() => {});
  return proxima;
}

/**
 * Lê o rascunho da sessão informada. Se o guardado for de OUTRA sessão ou de
 * OUTRO usuário, descarta em vez de misturar.
 */
export async function carregarRascunho(
  workoutLogId: string,
  expectedUserId?: string,
): Promise<RascunhoSessao | null> {
  await filaOperacoes;
  const d = await db();
  if (!d) return null;
  try {
    const r = (await d.get(STORE_RASCUNHO, CHAVE)) as RascunhoSessao | undefined;
    if (!r) return null;
    const activeUserId = expectedUserId ?? getUser()?.userId;
    if (
      r.workoutLogId !== workoutLogId ||
      (r.userId && activeUserId && r.userId !== activeUserId)
    ) {
      await descartarRascunho();
      return null;
    }
    return r;
  } catch {
    return null; // rascunho corrompido nunca pode impedir o treino de abrir
  }
}

function mesclar(
  workoutLogId: string,
  muda: (r: RascunhoSessao) => void,
): Promise<void> {
  return enfileirar(async () => {
    const d = await db();
    if (!d) return;
    try {
      const activeUserId = getUser()?.userId;
      const atual =
        ((await d.get(STORE_RASCUNHO, CHAVE)) as RascunhoSessao | undefined) ?? null;
      const mesmoDono =
        !atual?.userId || !activeUserId || atual.userId === activeUserId;
      const base =
        atual && atual.workoutLogId === workoutLogId && mesmoDono
          ? atual
          : vazio(workoutLogId, activeUserId);
      if (activeUserId) base.userId = activeUserId;
      muda(base);
      base.atualizadoEm = Date.now();
      await d.put(STORE_RASCUNHO, base);
    } catch {
      /* falha ao gravar rascunho não pode atrapalhar o treino */
    }
  });
}

export function salvarExercicio(
  workoutLogId: string,
  weId: string,
  dados: RascunhoExercicio,
): Promise<void> {
  return mesclar(workoutLogId, (r) => {
    r.exercicios[weId] = { ...r.exercicios[weId], ...dados };
  });
}

/** Grava vários exercícios modificados num único read-modify-write serializado. */
export function salvarExerciciosEmLote(
  workoutLogId: string,
  lote: Record<string, RascunhoExercicio>,
): Promise<void> {
  const entradas = Object.entries(lote);
  if (entradas.length === 0) return Promise.resolve();
  return mesclar(workoutLogId, (r) => {
    for (const [weId, dados] of entradas) {
      r.exercicios[weId] = { ...r.exercicios[weId], ...dados };
    }
  });
}

/** `terminaEm` é o instante em que o descanso acaba; `null` fecha o timer. */
export function salvarTimer(
  workoutLogId: string,
  terminaEm: number | null,
  rotulo?: string | null,
): Promise<void> {
  return mesclar(workoutLogId, (r) => {
    r.timerTerminaEm = terminaEm;
    r.timerRotulo = terminaEm ? (rotulo ?? null) : null;
  });
}

export function descartarRascunho(): Promise<void> {
  return enfileirar(async () => {
    const d = await db();
    if (!d) return;
    try {
      await d.delete(STORE_RASCUNHO, CHAVE);
    } catch {
      /* ignore */
    }
  });
}
