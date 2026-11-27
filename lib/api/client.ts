import { clearSession } from '../auth/storage';
import { clearCelebratedAchievements } from '../programs/celebration-memory';
import { limpar as limparCache } from './cache-modulo';

/**
 * A API é chamada no MESMO domínio do app (/api). O Next proxia até o backend
 * (ver `rewrites` em next.config.mjs). Assim o cookie httpOnly de sessão é
 * first-party e funciona em todo navegador — inclusive iOS/Safari, que bloqueia
 * cookie de terceiro entre domínios diferentes (ex: Vercel ↔ VPS).
 */
const BASE = '/api';
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let handlingUnauthorized = false;

/**
 * Sessão inválida/expirada: limpa o usuário local e o cache em memória antes de
 * voltar pro login. NÃO apaga o IndexedDB (outbox/rascunho) aqui — se o mesmo
 * aluno redigitar o PIN, o treino feito offline é preservado e sincronizado;
 * se outro usuário logar (ou clicar em Sair), o AuthProvider limpa os stores.
 */
function handleUnauthorized() {
  if (typeof window === 'undefined' || handlingUnauthorized) return;
  handlingUnauthorized = true;
  clearSession();
  limparCache();
  clearCelebratedAchievements();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
  handlingUnauthorized = false;
}

async function requestRaw<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; headers: Headers }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      // envia/recebe o cookie httpOnly de sessão (JWT)
      credentials: 'include',
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      msg = Array.isArray(body?.message)
        ? body.message.join(', ')
        : (body?.message ?? msg);
    } catch {
      /* ignore */
    }
    // 401 fora do login = sessão caiu → desloga. (No login, 401 é só "PIN errado".)
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      handleUnauthorized();
    }
    throw new ApiError(res.status, msg);
  }

  if (res.status === 204) return { data: undefined as T, headers: res.headers };
  const text = await res.text();
  if (!text) return { data: undefined as T, headers: res.headers };
  try {
    return { data: JSON.parse(text) as T, headers: res.headers };
  } catch {
    throw new ApiError(res.status, 'Resposta inválida do servidor');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await requestRaw<T>(path, options);
  return data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getWithTotal: async <T>(path: string): Promise<{ data: T; total: number | null }> => {
    const { data, headers } = await requestRaw<T>(path);
    const rawTotal = headers.get('X-Total-Count');
    const parsedTotal = rawTotal !== null ? Number.parseInt(rawTotal, 10) : Number.NaN;
    return {
      data,
      total: Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : null,
    };
  },
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  downloadFile: async (path: string, fallbackFilename: string): Promise<void> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: 'GET',
        signal: controller.signal,
        credentials: 'include',
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      try {
        const body = await res.json();
        msg = Array.isArray(body?.message)
          ? body.message.join(', ')
          : (body?.message ?? msg);
      } catch {
        /* ignore */
      }
      if (res.status === 401) {
        handleUnauthorized();
      }
      throw new ApiError(res.status, msg);
    }

    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="?([^";\n]+)"?/i);
    const filename = match?.[1] || fallbackFilename;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  },
};

/** Reexecuta uma operação gravada na fila offline (lib/offline/queue). */
export function replay<T>(method: string, path: string, body?: unknown) {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
