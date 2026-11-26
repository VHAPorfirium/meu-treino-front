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
import { flush, limparFilaOffline, limparSeOutroUsuario } from '../offline/queue';
import { clearCelebratedAchievements } from '../programs/celebration-memory';
import { clearPushSyncFlag, revokePushSubscription } from '../push/push-session';
import type { AuthUser } from '../types';
import { authApi } from '../api/endpoints';
import {
  clearSession,
  getUser,
  roleHome,
  saveSession,
  userHome,
} from './storage';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completePasswordChange: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const localUser = getUser();
    if (!localUser) {
      setLoading(false);
      return;
    }

    // Offline (ex.: academia sem sinal): usa o mt_user local para abrir o app.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setUser(localUser);
      setLoading(false);
      return;
    }

    // Online: valida o cookie httpOnly antes de montar telas protegidas,
    // evitando rajada de 401 paralelos quando a sessão já expirou.
    authApi
      .me()
      .then((verifiedUser) => {
        if (cancelled) return;
        saveSession(verifiedUser);
        setUser(verifiedUser);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          return;
        }
        // Rede oscilando / backend reiniciando: mantém sessão local
        setUser(localUser);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(identifier: string, password: string) {
    const previousUser = getUser();
    const res = await authApi.login(identifier, password);
    const authUser: AuthUser = {
      userId: res.user.id,
      role: res.user.role,
      name: res.user.name,
      username: res.user.username,
      mustChangePassword: res.user.mustChangePassword,
    };

    limparCache();
    clearPushSyncFlag();

    // Em aparelho compartilhado (login direto ou após 401): limpa IndexedDB se o
    // usuário mudou; se for o MESMO aluno relogando após 401, preserva e sincroniza.
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
    if (typeof navigator === 'undefined' || navigator.onLine) {
      void flush(authUser.userId);
    }
    router.replace(userHome(authUser));
  }

  function completePasswordChange() {
    if (!user) return;
    const updatedUser: AuthUser = { ...user, mustChangePassword: false };
    saveSession(updatedUser);
    setUser(updatedUser);
    router.replace(roleHome(updatedUser.role));
  }

  async function logout() {
    // Desvincula Web Push no backend ANTES de limpar o cookie httpOnly
    await revokePushSubscription();
    await authApi.logout().catch(() => {}); // limpa o cookie httpOnly no backend
    clearSession();
    limparCache(); // nada de um usuário sobrevive à sessão do outro
    clearCelebratedAchievements();
    await limparFilaOffline(); // limpa IndexedDB (outbox + rascunho)
    setUser(null);
    router.replace('/login');
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, completePasswordChange }}
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
