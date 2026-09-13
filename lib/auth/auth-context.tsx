'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '../types';
import { authApi } from '../api/endpoints';
import {
  clearSession,
  getUser,
  roleHome,
  saveSession,
} from './storage';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
    setLoading(false);
  }, []);

  async function login(pin: string) {
    const res = await authApi.login(pin); // backend identifica pelo PIN e seta o cookie httpOnly
    const authUser: AuthUser = {
      userId: res.user.id,
      role: res.user.role,
      name: res.user.name,
    };
    saveSession(authUser);
    setUser(authUser);
    router.replace(roleHome(authUser.role));
  }

  async function logout() {
    await authApi.logout().catch(() => {}); // limpa o cookie httpOnly no backend
    clearSession();
    setUser(null);
    router.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
