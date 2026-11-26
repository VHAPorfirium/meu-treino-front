'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { userHome } from '@/lib/auth/storage';
import {
  formatLoginIdentifierInput,
  isCpfLikeInput,
  isValidCpf,
} from '@/lib/auth/credentials';
import { ApiError } from '@/lib/api/client';
import { triggerHaptic } from '@/lib/haptics';
import { unlockAudio } from '@/lib/audio';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(userHome(user));
    }
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    unlockAudio();

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      triggerHaptic('warning');
      setError('Informe seu CPF (ou apelido de acesso).');
      return;
    }
    if (isCpfLikeInput(trimmedId) && !isValidCpf(trimmedId)) {
      triggerHaptic('warning');
      setError('CPF inválido. Confira os 11 dígitos.');
      return;
    }
    if (!password) {
      triggerHaptic('warning');
      setError('Informe sua senha.');
      return;
    }

    triggerHaptic('medium');
    setBusy(true);
    setError(null);
    try {
      await login(trimmedId, password);
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('warning');
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.',
      );
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-paper px-4 py-3 text-base font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none transition';

  return (
    <div className="app-shell safe-top safe-bottom items-center justify-center px-5 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="font-display text-[32px] font-extrabold uppercase tracking-[0.22em] text-brand">
            Ritmo
          </div>
          <h1 className="mt-5 font-display text-[26px] font-extrabold tracking-tight text-ink">
            Que bom te ver de novo
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-muted2">
            Entre com seu CPF e senha — seu perfil é identificado automaticamente.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-7 space-y-4 rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-7"
        >
          <div className="space-y-1.5">
            <label htmlFor="login-identifier" className="block text-xs font-extrabold uppercase tracking-wide text-muted">
              CPF
            </label>
            <input
              id="login-identifier"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              placeholder="000.000.000-00"
              value={identifier}
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setIdentifier(formatLoginIdentifierInput(e.target.value));
              }}
              className={inputClass}
            />
            <p className="text-[11px] font-semibold text-muted2">
              Conta antiga ainda sem CPF? Digite seu apelido de acesso.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-extrabold uppercase tracking-wide text-muted">
              Senha
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                disabled={busy}
                onChange={(e) => {
                  setError(null);
                  setPassword(e.target.value);
                }}
                className={`${inputClass} pr-20`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-muted hover:bg-chip hover:text-ink"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2.5 text-sm font-semibold text-brand animate-shake"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3.5 text-base font-extrabold text-white shadow-brand transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-bold text-muted2">
          Esqueceu sua senha? Peça a redefinição na recepção ou ao administrador.
        </p>
      </div>
    </div>
  );
}
