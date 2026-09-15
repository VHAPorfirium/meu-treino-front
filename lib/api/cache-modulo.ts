/**
 * Cache em memória do módulo, para dados de catálogo (Frente G · G6).
 *
 * Por que existe: o `ExerciseBrowser` refazia `GET /muscle-groups` e
 * `GET /exercises/equipment` **a cada montagem do componente** — ou seja, toda
 * vez que o modal "Escolher exercícios" abria. Esses dados só mudam em reseed.
 * Matar essas chamadas aqui não custa nada no servidor e é o melhor
 * custo-benefício da frente.
 *
 * ── Limites, de propósito ───────────────────────────────────────────────────
 * Vive na memória da aba: morre ao recarregar a página e **não** é
 * `localStorage`. Isso é intencional — dado de API não fica persistido no
 * aparelho, e ao trocar de usuário não há resquício em disco.
 *
 * `limpar()` é chamado no logout: mesmo sendo catálogo (igual pra todo mundo),
 * a regra de "nada de um usuário sobrevive à sessão do outro" vale sem exceção.
 */
type Entrada = { valor: unknown; expiraEm: number };

const memoria = new Map<string, Entrada>();
const emVoo = new Map<string, Promise<unknown>>();

/** 6 h — o mesmo TTL do cache do servidor, pra não haver duas verdades. */
export const TTL_CATALOGO = 6 * 60 * 60 * 1000;

export async function lembrar<T>(
  chave: string,
  ttlMs: number,
  produzir: () => Promise<T>,
): Promise<T> {
  const agora = Date.now();
  const guardado = memoria.get(chave);
  if (guardado && guardado.expiraEm > agora) return guardado.valor as T;

  // duas montagens simultâneas do mesmo componente = uma requisição só
  const jaEmVoo = emVoo.get(chave) as Promise<T> | undefined;
  if (jaEmVoo) return jaEmVoo;

  const promessa = produzir()
    .then((valor) => {
      memoria.set(chave, { valor, expiraEm: Date.now() + ttlMs });
      return valor;
    })
    .finally(() => emVoo.delete(chave));

  emVoo.set(chave, promessa);
  return promessa;
}

/** Esvazia o cache. Sem argumento, tudo; com prefixo, só o que casar. */
export function limpar(prefixo?: string): void {
  if (!prefixo) {
    memoria.clear();
    emVoo.clear();
    return;
  }
  for (const chave of Array.from(memoria.keys())) {
    if (chave.startsWith(prefixo)) memoria.delete(chave);
  }
}
