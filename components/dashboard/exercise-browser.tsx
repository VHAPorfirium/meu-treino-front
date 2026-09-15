'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type {
  ConfigExercicio,
  EquipamentoOpcao,
  Exercise,
  ExercicioSelecionado,
  MuscleGroup,
  PaginatedExercises,
} from '@/lib/types';
import {
  equipamentoExercicio,
  musculoExercicio,
  nomeExercicio,
} from '@/lib/exercicios/modo';
import { GifModal } from './gif-modal';
import { exercisesApi, muscleGroupsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

const PAGE_SIZES = [24, 48, 96, 200];

function errorMessage(e: unknown): string {
  return e instanceof ApiError
    ? `${e.message} (HTTP ${e.status})`
    : 'Falha de rede — verifique sua conexão.';
}

const nf = new Intl.NumberFormat('pt-BR');

/**
 * Modo de seleção múltipla (E7). Quando presente, cada card vira um toggle e o
 * painel de séries/reps/descanso abre **embaixo do próprio card**, sem trocar de
 * tela. A seleção mora fora daqui (no modal), então ela sobrevive a troca de
 * página, filtro e busca — que é o ponto todo da melhoria.
 */
export interface SelecaoMultipla {
  itens: Map<string, ExercicioSelecionado>;
  onToggle: (ex: Exercise) => void;
  onConfig: (exerciseId: string, patch: Partial<ConfigExercicio>) => void;
}

export function ExerciseBrowser({
  selecao,
}: {
  selecao?: SelecaoMultipla;
}) {
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [equipments, setEquipments] = useState<EquipamentoOpcao[]>([]);

  // filtros
  const [group, setGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  // paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  // E12 — qual exercício está com o GIF aberto (null = nenhum)
  const [vendoGif, setVendoGif] = useState<Exercise | null>(null);
  const [data, setData] = useState<PaginatedExercises | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // chips de grupo + lista de equipamentos (uma vez)
  useEffect(() => {
    muscleGroupsApi.list().then(setGroups).catch((e) => setError(errorMessage(e)));
    exercisesApi.equipment().then(setEquipments).catch(() => {});
  }, [attempt]);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // qualquer mudança de filtro volta pra página 1 (senão você ficaria numa
  // página que não existe mais no novo recorte e veria lista vazia)
  useEffect(() => {
    setPage(1);
  }, [group, equipment, debounced, pageSize]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    exercisesApi
      .list({
        muscleGroup: group || undefined,
        equipment: equipment || undefined,
        search: debounced || undefined,
        page,
        pageSize,
      })
      .then((r) => {
        if (cancelado) return;
        setData(r);
        // o backend ajusta a página ao intervalo válido — refletimos aqui
        if (r.page !== page) setPage(r.page);
      })
      .catch((e) => {
        if (cancelado) return;
        setData(null);
        setError(errorMessage(e));
      })
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [group, equipment, debounced, page, pageSize, attempt]);

  const chips = useMemo(
    () => [{ id: '', name: '', displayName: 'Todos', exerciseCount: 0 }, ...groups],
    [groups],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const irPara = useCallback(
    (p: number) => {
      setPage(Math.min(Math.max(1, p), totalPages));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [totalPages],
  );

  const temFiltro = Boolean(group || equipment || debounced);

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar em português ou inglês (nome, aparelho, músculo)…"
        className="mb-3 w-full rounded-xl border border-line2 bg-card px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-faint"
      />

      {/* grupos musculares */}
      <div className="mb-2 flex flex-wrap gap-2">
        {chips.map((g) => (
          <button
            key={g.id || 'all'}
            onClick={() => setGroup(g.name)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              group === g.name ? 'bg-ink text-white' : 'bg-chip text-muted'
            }`}
          >
            {g.displayName}
          </button>
        ))}
      </div>

      {/* equipamento + tamanho da página */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          className="rounded-full border border-line2 bg-card px-3 py-1.5 text-xs font-bold capitalize text-ink"
          aria-label="Filtrar por equipamento"
        >
          <option value="">Todos os equipamentos</option>
          {/* valor em inglês (é o que o filtro casa), rótulo em pt (E11) */}
          {equipments.map((eq) => (
            <option key={eq.valor} value={eq.valor}>
              {eq.rotulo}
            </option>
          ))}
        </select>

        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-full border border-line2 bg-card px-3 py-1.5 text-xs font-bold text-ink"
          aria-label="Exercícios por página"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} por página
            </option>
          ))}
        </select>

        {temFiltro && (
          <button
            onClick={() => {
              setGroup('');
              setEquipment('');
              setSearch('');
            }}
            className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted"
          >
            Limpar filtros
          </button>
        )}

        {/* contador — deixa explícito que dá pra chegar em todos */}
        {!loading && !error && (
          <span className="ml-auto text-xs font-semibold text-muted2">
            {total === 0
              ? 'nenhum resultado'
              : `${nf.format(total)} exercício${total > 1 ? 's' : ''}${
                  temFiltro ? ' (filtrado)' : ''
                } · página ${data?.page ?? 1} de ${nf.format(totalPages)}`}
          </span>
        )}
      </div>

      {loading && <p className="py-6 text-center text-muted2">Carregando…</p>}

      {!loading && error && (
        <div className="my-4 rounded-2xl border border-line bg-card p-4 text-center">
          <p className="text-sm font-extrabold text-brand">
            Não foi possível carregar o catálogo.
          </p>
          <p className="mt-1 text-xs font-semibold text-muted2">{error}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {selecao ? (
        <div className="space-y-2">
          {items.map((ex) => {
            const escolhido = selecao.itens.get(ex.id);
            return (
              <div
                key={ex.id}
                className={`overflow-hidden rounded-2xl border bg-card transition ${
                  escolhido ? 'border-brand' : 'border-line'
                }`}
              >
                {/*
                  E12 — dois alvos de clique separados. Antes o card inteiro era
                  um <button>; botão dentro de botão é HTML inválido e o clique
                  interno não funcionaria. Agora: a miniatura abre o GIF, o resto
                  seleciona. Quem não quer ver o GIF não muda nada no fluxo.
                */}
                <div className="flex items-center gap-3 p-2.5">
                  <button
                    type="button"
                    onClick={() => setVendoGif(ex)}
                    title="Ver o exercício em movimento"
                    aria-label={`Ver o GIF de ${nomeExercicio(ex)}`}
                    className="group relative shrink-0 rounded-xl"
                  >
                    <Thumb url={ex.thumbnailUrl} />
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-ink/0 text-transparent transition group-hover:bg-ink/55 group-hover:text-white">
                      ▶
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selecao.onToggle(ex)}
                    aria-pressed={Boolean(escolhido)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold capitalize">
                        {nomeExercicio(ex)}
                      </p>
                      <p className="text-xs font-semibold capitalize text-muted2">
                        {musculoExercicio(ex)} · {equipamentoExercicio(ex)}
                      </p>
                    </div>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-extrabold ${
                        escolhido ? 'bg-brand text-white' : 'bg-chip text-ink'
                      }`}
                    >
                      {escolhido ? '✓' : '+'}
                    </span>
                  </button>
                </div>

                {escolhido && (
                  <div className="space-y-2 border-t border-line px-2.5 pb-2.5 pt-2">
                    {escolhido.config.mode === 'TIME' ? (
                      // E10 — cardio (e prancha, alongamento): o que importa é o tempo
                      <div className="grid grid-cols-2 gap-2">
                        <CampoConfig
                          label="Minutos"
                          value={escolhido.config.minutes}
                          onChange={(v) => selecao.onConfig(ex.id, { minutes: v })}
                        />
                        <CampoConfig
                          label="Descanso (s)"
                          value={escolhido.config.rest}
                          onChange={(v) => selecao.onConfig(ex.id, { rest: v })}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <CampoConfig
                          label="Séries"
                          value={escolhido.config.sets}
                          onChange={(v) => selecao.onConfig(ex.id, { sets: v })}
                        />
                        <CampoConfig
                          label="Reps"
                          value={escolhido.config.reps}
                          onChange={(v) => selecao.onConfig(ex.id, { reps: v })}
                          texto
                        />
                        <CampoConfig
                          label="Descanso (s)"
                          value={escolhido.config.rest}
                          onChange={(v) => selecao.onConfig(ex.id, { rest: v })}
                        />
                      </div>
                    )}

                    {/* o grupo muscular só SUGERE o modo — prancha é abdômen e é por tempo */}
                    <button
                      type="button"
                      onClick={() =>
                        selecao.onConfig(ex.id, {
                          mode: escolhido.config.mode === 'TIME' ? 'REPS' : 'TIME',
                        })
                      }
                      className="text-[11px] font-bold text-muted2 underline"
                    >
                      {escolhido.config.mode === 'TIME'
                        ? 'medir por séries e repetições'
                        : 'medir por tempo'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => setVendoGif(ex)}
              title="Ver o exercício em movimento"
              className="overflow-hidden rounded-2xl border border-line bg-card text-left transition hover:border-line2"
            >
              {ex.thumbnailUrl ? (
                <Image
                  src={ex.thumbnailUrl}
                  alt={nomeExercicio(ex)}
                  width={200}
                  height={120}
                  className="h-24 w-full bg-white object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-24" style={{ background: STRIPE }} />
              )}
              <div className="p-3">
                <p className="truncate text-[13px] font-extrabold capitalize leading-tight">
                  {nomeExercicio(ex)}
                </p>
                <p className="mt-1 text-[11px] font-semibold capitalize text-muted2">
                  {equipamentoExercicio(ex)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-muted2">Nada encontrado.</p>
      )}

      {vendoGif && (
        <GifModal exercise={vendoGif} onClose={() => setVendoGif(null)} />
      )}

      {!loading && !error && totalPages > 1 && (
        <Paginacao
          page={data?.page ?? 1}
          totalPages={totalPages}
          onGo={irPara}
        />
      )}
    </div>
  );
}

/** Controles de página: primeira/anterior · números com reticências · próxima/última. */
function Paginacao({
  page,
  totalPages,
  onGo,
}: {
  page: number;
  totalPages: number;
  onGo: (p: number) => void;
}) {
  // janela de até 5 números em volta da página atual
  const numeros = useMemo(() => {
    const janela = 5;
    let ini = Math.max(1, page - Math.floor(janela / 2));
    const fim = Math.min(totalPages, ini + janela - 1);
    ini = Math.max(1, fim - janela + 1);
    const out: (number | '…')[] = [];
    if (ini > 1) out.push(1);
    if (ini > 2) out.push('…');
    for (let p = ini; p <= fim; p++) out.push(p);
    if (fim < totalPages - 1) out.push('…');
    if (fim < totalPages) out.push(totalPages);
    return out;
  }, [page, totalPages]);

  const btn =
    'min-w-9 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition disabled:opacity-40';

  return (
    <nav
      aria-label="Paginação do catálogo"
      className="mt-5 flex flex-wrap items-center justify-center gap-1.5"
    >
      <button
        className={`${btn} bg-chip text-ink`}
        onClick={() => onGo(1)}
        disabled={page === 1}
        aria-label="Primeira página"
      >
        ««
      </button>
      <button
        className={`${btn} bg-chip text-ink`}
        onClick={() => onGo(page - 1)}
        disabled={page === 1}
      >
        ‹ Anterior
      </button>

      {numeros.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1 text-xs text-muted2">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onGo(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${btn} ${
              n === page ? 'bg-brand text-white shadow-brand' : 'bg-chip text-ink'
            }`}
          >
            {n}
          </button>
        ),
      )}

      <button
        className={`${btn} bg-chip text-ink`}
        onClick={() => onGo(page + 1)}
        disabled={page === totalPages}
      >
        Próxima ›
      </button>
      <button
        className={`${btn} bg-chip text-ink`}
        onClick={() => onGo(totalPages)}
        disabled={page === totalPages}
        aria-label="Última página"
      >
        »»
      </button>
    </nav>
  );
}

/** Campo compacto do painel inline de configuração (E7). */
function CampoConfig({
  label,
  value,
  onChange,
  texto,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  texto?: boolean;
}) {
  return (
    <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted2">
      {label}
      <input
        inputMode={texto ? 'text' : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line2 bg-white px-2 py-1.5 text-center text-sm font-extrabold text-ink"
      />
    </label>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={44}
      height={44}
      className="h-11 w-11 rounded-xl bg-white object-cover"
      unoptimized
    />
  ) : (
    <div className="h-11 w-11 rounded-xl" style={{ background: STRIPE }} />
  );
}
