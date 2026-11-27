'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '../api/client';
import { limpar as limparCache } from '../api/cache-modulo';
import {
  flush,
  limparFilaOffline,
  limparSeOutroUsuario,
  pendingCount,
} from '../offline/queue';
import { clearCelebratedAchievements } from '../programs/celebration-memory';
import { clearPushSyncFlag, revokePushSubscription } from '../push/push-session';
import type { AuthUser, ProfileChoice, Role } from '../types';
import { authApi } from '../api/endpoints';
import {
  clearSession,
  getUser,
  roleHome,
  saveSession,
  userHome,
} from './storage';

export type LoginActionResult =
  | { requiresProfileSelection: false }
  | { requiresProfileSelection: true; profiles: ProfileChoice[] };

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  linkedProfiles: ProfileChoice[];
  login: (
    identifier: string,
    password: string,
    role?: Role,
  ) => Promise<LoginActionResult>;
  switchProfile: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
  completePasswordChange: () => void;
  refreshUserSession: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function canHaveLinkedProfiles(u: AuthUser | null): boolean {
  return Boolean(
    u &&
      !u.mustChangePassword &&
      (u.role === 'PERSONAL' || u.role === 'TRAINEE'),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [linkedProfiles, setLinkedProfiles] = useState<ProfileChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLogoutCount, setPendingLogoutCount] = useState<number | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const loadLinkedProfiles = (targetUser: AuthUser) => {
      if (!canHaveLinkedProfiles(targetUser)) {
        setLinkedProfiles([]);
        return;
      }
      authApi
        .linkedProfiles()
        .then((profiles) => {
          if (!cancelled) setLinkedProfiles(profiles);
        })
        .catch(() => {});
    };

    const revalidateSession = (fallbackLocal: AuthUser | null) => {
      return authApi
        .me()
        .then((verifiedUser) => {
          if (cancelled) return;
          saveSession(verifiedUser);
          setUser(verifiedUser);
          loadLinkedProfiles(verifiedUser);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 401) {
            setUser(null);
            setLinkedProfiles([]);
            return;
          }
          // Rede oscilando / backend reiniciando: mantém sessão local
          if (fallbackLocal) setUser(fallbackLocal);
        });
    };

    // Registra o listener `online` incondicionalmente (mesmo quando inicia em /login):
    // assim quem faz login durante esta sessão também revalida ao reconectar.
    const handleOnline = () => {
      const currentLocal = getUser();
      if (!currentLocal) return;
      void revalidateSession(currentLocal);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    const localUser = getUser();
    if (!localUser) {
      setLoading(false);
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Offline (ex.: academia sem sinal): usa o mt_user local para abrir o app
      // e revalida automaticamente assim que a conexão retornar.
      setUser(localUser);
      setLoading(false);
    } else {
      // Online: valida o cookie httpOnly antes de montar telas protegidas,
      // evitando rajada de 401 paralelos quando a sessão já expirou.
      void revalidateSession(localUser).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, []);

  useEffect(() => {
    if (pendingLogoutCount === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmingLogout) {
        setPendingLogoutCount(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingLogoutCount, confirmingLogout]);

  function refreshLinkedProfiles(targetUser: AuthUser) {
    if (!canHaveLinkedProfiles(targetUser)) {
      setLinkedProfiles([]);
      return;
    }
    authApi
      .linkedProfiles()
      .then(setLinkedProfiles)
      .catch(() => setLinkedProfiles([]));
  }

  async function finalizeSession(authUser: AuthUser) {
    const previousUser = getUser();
    limparCache();
    clearPushSyncFlag();

    if (previousUser && previousUser.userId !== authUser.userId) {
      clearCelebratedAchievements();
      await limparFilaOffline();
    } else {
      const clearedForeign = await limparSeOutroUsuario(authUser.userId);
      if (clearedForeign) {
        clearCelebratedAchievements();
      }
    }

    saveSession(authUser);
    setUser(authUser);
    refreshLinkedProfiles(authUser);

    if (typeof navigator === 'undefined' || navigator.onLine) {
      void flush(authUser.userId);
    }
    router.replace(userHome(authUser));
  }

  async function login(
    identifier: string,
    password: string,
    role?: Role,
  ): Promise<LoginActionResult> {
    const res = await authApi.login(identifier, password, role);
    if (res.requiresProfileSelection) {
      return { requiresProfileSelection: true, profiles: res.profiles };
    }

    const authUser: AuthUser = {
      userId: res.user.id,
      role: res.user.role,
      name: res.user.name,
      username: res.user.username,
      mustChangePassword: res.user.mustChangePassword,
    };
    await finalizeSession(authUser);
    return { requiresProfileSelection: false };
  }

  async function switchProfile(role: Role) {
    // Evita perda silenciosa de séries offline ao trocar de perfil (Personal ↔ Aluno):
    // tenta sincronizar antes e bloqueia a troca se ainda restarem operações pendentes.
    if (user) {
      const before = await pendingCount();
      if (before > 0) {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          await flush(user.userId);
        }
        const remaining = await pendingCount();
        if (remaining > 0) {
          throw new Error(
            'Há registros de treino pendentes de sincronização offline. Conecte-se à internet antes de trocar de perfil.',
          );
        }
      }
    }

    const res = await authApi.switchProfile(role);
    const authUser: AuthUser = {
      userId: res.user.id,
      role: res.user.role,
      name: res.user.name,
      username: res.user.username,
      mustChangePassword: res.user.mustChangePassword,
    };
    await finalizeSession(authUser);
  }

  function completePasswordChange() {
    if (!user) return;
    const updatedUser: AuthUser = { ...user, mustChangePassword: false };
    saveSession(updatedUser);
    setUser(updatedUser);
    refreshLinkedProfiles(updatedUser);
    router.replace(roleHome(updatedUser.role));
  }

  function refreshUserSession(patch: Partial<AuthUser>) {
    setUser((current) => {
      if (!current) return current;
      const updated: AuthUser = { ...current, ...patch };
      saveSession(updated);
      return updated;
    });
  }

  async function performLogout() {
    setConfirmingLogout(true);
    try {
      await revokePushSubscription();
      await authApi.logout().catch(() => {});
      clearSession();
      limparCache();
      clearCelebratedAchievements();
      await limparFilaOffline();
      setLinkedProfiles([]);
      setUser(null);
      setPendingLogoutCount(null);
      router.replace('/login');
    } finally {
      setConfirmingLogout(false);
    }
  }

  async function logout() {
    // Tenta sincronizar a fila offline antes de sair; se restarem registros locais
    // (ex.: aluno sem sinal na academia), pede confirmação explícita em vez de descartá-los.
    if (user) {
      const before = await pendingCount();
      if (before > 0) {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          await flush(user.userId);
        }
        const remaining = await pendingCount();
        if (remaining > 0) {
          setPendingLogoutCount(remaining);
          return;
        }
      }
    }
    await performLogout();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        linkedProfiles,
        login,
        switchProfile,
        logout,
        completePasswordChange,
        refreshUserSession,
      }}
    >
      {children}
      {pendingLogoutCount !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-offline-title"
          className="safe-top safe-bottom fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
        >
          <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-5 shadow-soft">
            <h2
              id="logout-offline-title"
              className="font-display text-lg font-extrabold text-ink"
            >
              Registros pendentes offline
            </h2>
            <p className="mt-2 text-sm text-muted">
              Há{' '}
              <strong className="font-bold text-ink">
                {pendingLogoutCount}{' '}
                {pendingLogoutCount === 1
                  ? 'registro de treino'
                  : 'registros de treino'}
              </strong>{' '}
              ainda não enviado{pendingLogoutCount === 1 ? '' : 's'} para o servidor.
              Se você sair agora, esses dados locais serão descartados.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={confirmingLogout}
                onClick={() => setPendingLogoutCount(null)}
                className="flex-1 rounded-2xl bg-inverse px-4 py-2.5 text-sm font-extrabold text-on-inverse transition active:scale-[.98] disabled:opacity-50"
              >
                Continuar no app
              </button>
              <button
                type="button"
                disabled={confirmingLogout}
                onClick={() => void performLogout()}
                className="flex-1 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm font-extrabold text-brand-ink transition active:scale-[.98] disabled:opacity-50"
              >
                {confirmingLogout ? 'Saindo…' : 'Sair e descartar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
