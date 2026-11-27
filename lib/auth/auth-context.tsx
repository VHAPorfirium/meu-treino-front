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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [linkedProfiles, setLinkedProfiles] = useState<ProfileChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const revalidateSession = (fallbackLocal: AuthUser | null) => {
      return authApi
        .me()
        .then((verifiedUser) => {
          if (cancelled) return;
          saveSession(verifiedUser);
          setUser(verifiedUser);
          if (verifiedUser.role !== 'ADMIN') {
            authApi
              .linkedProfiles()
              .then((profiles) => {
                if (!cancelled) setLinkedProfiles(profiles);
              })
              .catch(() => {});
          } else {
            setLinkedProfiles([]);
          }
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

    const localUser = getUser();
    if (!localUser) {
      setLoading(false);
      return;
    }

    // Offline (ex.: academia sem sinal): usa o mt_user local para abrir o app
    // e revalida automaticamente assim que a conexão retornar.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setUser(localUser);
      setLoading(false);
    } else {
      // Online: valida o cookie httpOnly antes de montar telas protegidas,
      // evitando rajada de 401 paralelos quando a sessão já expirou.
      void revalidateSession(localUser).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }

    const handleOnline = () => {
      const currentLocal = getUser();
      if (!currentLocal) return;
      void revalidateSession(currentLocal);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, []);

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
    if (authUser.role !== 'ADMIN') {
      authApi.linkedProfiles().then(setLinkedProfiles).catch(() => setLinkedProfiles([]));
    } else {
      setLinkedProfiles([]);
    }

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

  async function logout() {
    await revokePushSubscription();
    await authApi.logout().catch(() => {});
    clearSession();
    limparCache();
    clearCelebratedAchievements();
    await limparFilaOffline();
    setLinkedProfiles([]);
    setUser(null);
    router.replace('/login');
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
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
