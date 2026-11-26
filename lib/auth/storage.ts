import type { AuthUser, Role } from '../types';

// O JWT fica em cookie httpOnly (setado/limpo pelo backend, invisível ao JS).
// Aqui guardamos só o usuário (não sensível) num cookie legível, p/ roteamento por papel.
const USER_KEY = 'mt_user';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias
const VALID_ROLES: ReadonlySet<string> = new Set([
  'ADMIN',
  'RECEPTION',
  'PERSONAL',
  'TRAINEE',
]);

function secureAttr(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '; Secure'
    : '';
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secureAttr()}`;
}
function delCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureAttr()}`;
}
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
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
    const parsed = JSON.parse(raw) as Partial<AuthUser> | null;
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.role !== 'string' ||
      !VALID_ROLES.has(parsed.role)
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      name: parsed.name,
      role: parsed.role as Role,
      username: typeof parsed.username === 'string' ? parsed.username : '',
      mustChangePassword: Boolean(parsed.mustChangePassword),
    };
  } catch {
    return null;
  }
}

export function roleHome(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'RECEPTION':
      return '/recepcao';
    case 'PERSONAL':
      return '/dashboard';
    case 'TRAINEE':
      return '/treino';
  }
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'RECEPTION':
      return 'Portaria';
    case 'PERSONAL':
      return 'Personal';
    case 'TRAINEE':
      return 'Aluno';
  }
}

export function userHome(user: AuthUser): string {
  return user.mustChangePassword ? '/trocar-senha' : roleHome(user.role);
}
