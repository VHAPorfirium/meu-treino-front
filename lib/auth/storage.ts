import type { AuthUser, Role } from '../types';

// O JWT fica em cookie httpOnly (setado/limpo pelo backend, invisível ao JS).
// Aqui guardamos só o usuário (não sensível) num cookie legível, p/ roteamento por papel.
const USER_KEY = 'mt_user';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}
function delCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function saveSession(user: AuthUser) {
  setCookie(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  delCookie(USER_KEY);
}

export function getUser(): AuthUser | null {
  const raw = getCookie(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function roleHome(role: Role): string {
  return role === 'ADMIN' ? '/dashboard' : '/treino';
}
