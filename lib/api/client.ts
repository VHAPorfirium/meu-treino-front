import { clearSession } from '../auth/storage';

/**
 * A API é chamada no MESMO domínio do app (/api). O Next proxia até o backend
 * (ver `rewrites` em next.config.mjs). Assim o cookie httpOnly de sessão é
 * first-party e funciona em todo navegador — inclusive iOS/Safari, que bloqueia
 * cookie de terceiro entre domínios diferentes (Vercel ↔ Render).
 */
const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Sessão inválida/expirada: limpa o usuário local e volta pro login.
 * Sem isso o app ficava "logado" (roteamento usa o mt_user) com todas as
 * listas vazias, porque cada chamada protegida falhava em silêncio com 401.
 */
function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  clearSession();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login');
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    // envia/recebe o cookie httpOnly de sessão (JWT)
    credentials: 'include',
    cache: 'no-store',
  });

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

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
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
};

/** Reexecuta uma operação gravada na fila offline (lib/offline/queue). */
export function replay<T>(method: string, path: string, body?: unknown) {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
