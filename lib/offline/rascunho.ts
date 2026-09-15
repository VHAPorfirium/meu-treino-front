'use client';

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
 * que a sessão é finalizada, e ignorado se for de outra sessão.
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
  atualizadoEm: number;
  exercicios: Record<string, RascunhoExercicio>;
  /** instante absoluto (epoch ms) em que o descanso termina — não "segundos restantes" */
  timerTerminaEm?: number | null;
  timerRotulo?: string | null;
}

function vazio(workoutLogId: string): RascunhoSessao {
  return { id: CHAVE, workoutLogId, atualizadoEm: Date.now(), exercicios: {} };
}

/**
 * Lê o rascunho da sessão informada. Se o guardado for de OUTRA sessão (ela
 * finalizou o treino de ontem e hoje é outro), descarta em vez de misturar.
 */
export async function carregarRascunho(
  workoutLogId: string,
): Promise<RascunhoSessao | null> {
  const d = await db();
  if (!d) return null;
  try {
    const r = (await d.get(STORE_RASCUNHO, CHAVE)) as RascunhoSessao | undefined;
    if (!r) return null;
    if (r.workoutLogId !== workoutLogId) {
      await descartarRascunho();
      return null;
    }
    return r;
  } catch {
    return null; // rascunho corrompido nunca pode impedir o treino de abrir
  }
}

async function mesclar(
  workoutLogId: string,
  muda: (r: RascunhoSessao) => void,
): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    const atual =
      ((await d.get(STORE_RASCUNHO, CHAVE)) as RascunhoSessao | undefined) ?? null;
    const base =
      atual && atual.workoutLogId === workoutLogId ? atual : vazio(workoutLogId);
    muda(base);
    base.atualizadoEm = Date.now();
    await d.put(STORE_RASCUNHO, base);
  } catch {
    /* falha ao gravar rascunho não pode atrapalhar o treino */
  }
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

export async function descartarRascunho(): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    await d.delete(STORE_RASCUNHO, CHAVE);
  } catch {
    /* ignore */
  }
}

/** Agenda a gravação (a digitação chama isso a cada tecla). */
export function gravarComAtraso(fn: () => void, ms = 400): () => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}
