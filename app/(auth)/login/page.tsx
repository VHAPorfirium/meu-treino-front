'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel, userHome } from '@/lib/auth/storage';
import {
  formatLoginIdentifierInput,
  isCpfLikeInput,
  isValidCpf,
} from '@/lib/auth/credentials';
import type { ProfileChoice, Role } from '@/lib/types';
import { ApiError } from '@/lib/api/client';
import { triggerHaptic } from '@/lib/haptics';
import { unlockAudio } from '@/lib/audio';

function roleIcon(role: Role): string {
  switch (role) {
    case 'PERSONAL':
      return '🏋️';
    case 'TRAINEE':
      return '💪';
    case 'RECEPTION':
      return '🛎️';
    case 'ADMIN':
      return '🛡️';
  }
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileChoices, setProfileChoices] = useState<ProfileChoice[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(userHome(user));
    }
  }, [user, loading, router]);

  async function submitCredentials(selectedRole?: Role) {
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
      const result = await login(trimmedId, password, selectedRole);
      if (result.requiresProfileSelection) {
        triggerHaptic('light');
        setProfileChoices(result.profiles);
        return;
      }
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('warning');
      setProfileChoices(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível entrar. Tente novamente.',
      );
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submitCredentials();
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
            {profileChoices ? 'Escolha seu perfil' : 'Que bom te ver de novo'}
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-muted2">
            {profileChoices
              ? 'Seu CPF está vinculado a mais de um perfil. Como deseja entrar agora?'
              : 'Entre com seu CPF e senha — seu perfil é identificado automaticamente.'}
          </p>
        </div>

        {profileChoices ? (
          <div className="mt-7 space-y-3 rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-7">
            {profileChoices.map((profile) => (
              <button
                key={profile.role}
                type="button"
                disabled={busy}
                onClick={() => void submitCredentials(profile.role)}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-paper p-4 text-left transition hover:border-brand active:scale-[0.99] disabled:opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chip text-xl">
                  {roleIcon(profile.role)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-ink">
                    Entrar como {roleLabel(profile.role)}
                  </span>
                  <span className="block truncate text-xs font-bold text-muted2">
                    {profile.name} · @{profile.username}
                  </span>
                </span>
                <span className="text-base font-extrabold text-brand">→</span>
              </button>
            ))}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2.5 text-sm font-semibold text-brand"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setProfileChoices(null);
                setError(null);
              }}
              className="w-full pt-1 text-center text-xs font-extrabold text-muted2 hover:text-ink"
            >
              ← Voltar e alterar credenciais
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-7 space-y-4 rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-7"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="login-identifier"
                className="block text-xs font-extrabold uppercase tracking-wide text-muted"
              >
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
                Conta antiga ainda sem CPF? Digite seu apelido de acesso (ex.: victor.personal).
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-extrabold uppercase tracking-wide text-muted"
              >
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
        )}

        <p className="mt-6 text-center text-xs font-bold text-muted2">
          Esqueceu sua senha? Peça a redefinição na recepção ou ao administrador.
        </p>
      </div>
    </div>
  );
}
