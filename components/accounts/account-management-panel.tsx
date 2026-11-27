'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Role, UserSummary } from '@/lib/types';
import { usersApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel } from '@/lib/auth/storage';
import { copyText } from '@/lib/clipboard';
import {
  formatCpfInput,
  generateStrongPassword,
  isValidCpf,
  isValidUsername,
  normalizeUsername,
  passwordChecklist,
  suggestUsernameFromName,
  validateStrongPassword,
} from '@/lib/auth/credentials';
import { applyThemePreference, readInitialIsDark } from '@/lib/theme';
import { TraineeAvatar } from '@/components/dashboard/trainee-avatar';

type PanelMode = 'ADMIN' | 'RECEPTION';
type StatusFilter = 'all' | 'active' | 'inactive';

const ADMIN_ROLE_OPTIONS: { value: Role; label: string; icon: string }[] = [
  { value: 'TRAINEE', label: 'Aluno', icon: '💪' },
  { value: 'PERSONAL', label: 'Personal', icon: '🏋️' },
  { value: 'RECEPTION', label: 'Portaria', icon: '🛎️' },
  { value: 'ADMIN', label: 'Administrador', icon: '🛡️' },
];

function roleBadgeStyle(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-gold-bg text-gold';
    case 'RECEPTION':
      return 'bg-replace-bg text-replace';
    case 'PERSONAL':
      return 'bg-brand/10 text-brand-ink';
    case 'TRAINEE':
      return 'bg-chip text-muted';
  }
}

function describeError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function AccountManagementPanel({
  mode,
  headerExtra,
  embedded = false,
  refreshSignal = 0,
  onAccountsChanged,
}: {
  mode: PanelMode;
  headerExtra?: ReactNode;
  embedded?: boolean;
  refreshSignal?: number;
  onAccountsChanged?: () => void;
}) {
  const { user, linkedProfiles, switchProfile, logout, refreshUserSession } =
    useAuth();
  const [accounts, setAccounts] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    message: string;
    copyValue?: string;
    copyLabel?: string;
  } | null>(null);
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [switching, setSwitching] = useState(false);

  const isAdmin = mode === 'ADMIN';

  const showError = useCallback((message: string | null) => {
    if (message) setBanner(null);
    setErrorMessage(message);
  }, []);

  const showBanner = useCallback(
    (next: { message: string; copyValue?: string; copyLabel?: string } | null) => {
      if (next) setErrorMessage(null);
      setCopiedBanner(false);
      setBanner(next);
    },
    [],
  );

  useEffect(() => {
    setIsDark(readInitialIsDark());
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await usersApi.list();
      setAccounts(list);
    } catch (error) {
      showError(describeError(error, 'Não foi possível carregar os cadastros.'));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts, refreshSignal]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    applyThemePreference(next);
  }

  async function handleSwitch(targetRole: Role) {
    if (switching) return;
    setSwitching(true);
    showError(null);
    try {
      await switchProfile(targetRole);
    } catch (err) {
      showError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível alternar o perfil agora.',
      );
    } finally {
      setSwitching(false);
    }
  }

  function handleAccountUpdated(updated: UserSummary) {
    setAccounts((current) =>
      current
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    );
    if (updated.id === user?.userId) {
      refreshUserSession({
        name: updated.name,
        username: updated.username,
      });
    }
    onAccountsChanged?.();
  }

  async function copyBannerValue(value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopiedBanner(true);
      setTimeout(() => setCopiedBanner(false), 2000);
    } else {
      setErrorMessage(
        'Não foi possível copiar automaticamente — selecione o texto acima para copiar.',
      );
    }
  }

  const counts = useMemo(() => {
    const byRole: Record<Role, number> = {
      ADMIN: 0,
      RECEPTION: 0,
      PERSONAL: 0,
      TRAINEE: 0,
    };
    let activeCount = 0;
    for (const acc of accounts) {
      byRole[acc.role] += 1;
      if (acc.active) activeCount += 1;
    }
    return {
      total: accounts.length,
      active: activeCount,
      inactive: accounts.length - activeCount,
      byRole,
    };
  }, [accounts]);

  const roleFilterChoices: { value: Role | 'ALL'; label: string; count: number }[] = isAdmin
    ? [
        { value: 'ALL', label: 'Todos', count: counts.total },
        { value: 'TRAINEE', label: 'Alunos', count: counts.byRole.TRAINEE },
        { value: 'PERSONAL', label: 'Personais', count: counts.byRole.PERSONAL },
        { value: 'RECEPTION', label: 'Portaria', count: counts.byRole.RECEPTION },
        { value: 'ADMIN', label: 'Admins', count: counts.byRole.ADMIN },
      ]
    : [
        { value: 'ALL', label: 'Todos', count: counts.total },
        { value: 'TRAINEE', label: 'Alunos', count: counts.byRole.TRAINEE },
        { value: 'PERSONAL', label: 'Personais', count: counts.byRole.PERSONAL },
      ];

  const visibleAccounts = useMemo(() => {
    const q = searchText.trim().toLocaleLowerCase('pt-BR');
    return accounts.filter((acc) => {
      if (roleFilter !== 'ALL' && acc.role !== roleFilter) return false;
      if (statusFilter === 'active' && !acc.active) return false;
      if (statusFilter === 'inactive' && acc.active) return false;
      if (!q) return true;
      return (
        acc.name.toLocaleLowerCase('pt-BR').includes(q) ||
        acc.username.toLocaleLowerCase('pt-BR').includes(q) ||
        (acc.cpfMasked ?? '').includes(q)
      );
    });
  }, [accounts, roleFilter, statusFilter, searchText]);

  const bodyContent = (
    <div className={embedded ? 'space-y-5' : 'mx-auto max-w-6xl space-y-5 p-4 pb-16 sm:p-6 md:p-8'}>
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
              Gestão de acessos
            </p>
            <h2 className="font-display text-xl font-extrabold text-ink">
              Contas dos 4 perfis (Admin, Portaria, Personal e Alunos)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setIsCreating((open) => !open);
            }}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand transition active:scale-[0.99]"
          >
            {isCreating ? 'Fechar formulário' : '＋ Nova conta'}
          </button>
        </div>
      )}

      {headerExtra}

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Contas visíveis" value={counts.total} />
        <KpiCard label="Ativas" value={counts.active} tone="done" />
        <KpiCard label="Desativadas" value={counts.inactive} tone={counts.inactive > 0 ? 'skip' : undefined} />
        <KpiCard
          label={isAdmin ? 'Personais ativos' : 'Alunos ativos'}
          value={
            accounts.filter((a) => a.active && a.role === (isAdmin ? 'PERSONAL' : 'TRAINEE'))
              .length
          }
        />
      </div>

        {errorMessage && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-card p-3.5 text-sm font-semibold text-brand-ink">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="shrink-0 text-xs font-extrabold underline"
            >
              fechar
            </button>
          </div>
        )}

        {banner && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-done/40 bg-done-bg p-4 text-sm font-bold text-done-ink">
            <span className="select-text break-words">{banner.message}</span>
            <div className="flex shrink-0 items-center gap-2">
              {banner.copyValue && (
                <button
                  type="button"
                  onClick={() => void copyBannerValue(banner.copyValue!)}
                  className="rounded-xl border border-done/40 bg-paper px-3 py-1.5 text-xs font-extrabold text-ink"
                >
                  {copiedBanner ? '✓ Copiado' : (banner.copyLabel ?? 'Copiar')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-xs font-extrabold underline"
              >
                fechar
              </button>
            </div>
          </div>
        )}

        {isCreating && (
          <CreateAccountForm
            isAdmin={isAdmin}
            onCancel={() => setIsCreating(false)}
            onCreated={async (created, temporaryPassword) => {
              setIsCreating(false);
              await loadAccounts();
              onAccountsChanged?.();
              showBanner({
                message: `Conta criada: ${created.name} (@${created.username} · ${roleLabel(created.role)}). Senha temporária: ${temporaryPassword}`,
                copyValue: `Acesso Ritmo\nApelido: @${created.username}\nSenha temporária: ${temporaryPassword}`,
                copyLabel: 'Copiar acesso',
              });
            }}
          />
        )}

        {/* Busca + filtros */}
        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="🔍 Buscar por nome, @apelido ou final do CPF"
              className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
            />
            <div className="flex gap-1.5">
              {(
                [
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Ativos' },
                  { value: 'inactive', label: 'Inativos' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                    statusFilter === opt.value
                      ? 'bg-inverse text-on-inverse'
                      : 'bg-chip text-muted hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {roleFilterChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => setRoleFilter(choice.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                  roleFilter === choice.value
                    ? 'bg-brand text-white shadow-brand'
                    : 'bg-chip text-muted hover:text-ink'
                }`}
              >
                {choice.label} · {choice.count}
              </button>
            ))}
          </div>
        </section>

        {/* Lista de contas */}
        <section className="space-y-2.5">
          {loading && (
            <p className="py-10 text-center text-sm font-semibold text-muted2">
              Carregando cadastros…
            </p>
          )}
          {!loading && visibleAccounts.length === 0 && (
            <div className="rounded-2xl border border-line bg-card p-8 text-center">
              <p className="text-sm font-bold text-muted2">
                Nenhuma conta encontrada com os filtros atuais.
              </p>
            </div>
          )}
          {!loading &&
            visibleAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                isAdmin={isAdmin}
                isSelf={account.id === user?.userId}
                onUpdated={handleAccountUpdated}
                onFeedback={(message, copyValue, copyLabel) =>
                  showBanner({ message, copyValue, copyLabel })
                }
                onError={showError}
              />
            ))}
        </section>
    </div>
  );

  if (embedded) return bodyContent;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-sand">
      {/* Barra superior */}
      <header className="safe-top sticky top-0 z-30 border-b border-white/10 bg-inverse pb-3.5 text-on-inverse shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-display text-lg font-extrabold tracking-[0.18em] text-brand">
              RITMO
            </span>
            <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-extrabold text-on-inverse sm:inline-block">
              {isAdmin ? '🛡️ Administração' : '🛎️ Portaria'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {linkedProfiles.map((p) => (
              <button
                key={p.role}
                type="button"
                disabled={switching}
                onClick={() => void handleSwitch(p.role)}
                className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold text-on-inverse transition hover:bg-white/15 active:scale-95 disabled:opacity-50"
              >
                ⇄ {roleLabel(p.role)}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm transition hover:bg-white/15 active:scale-90"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-extrabold leading-tight">{user?.name}</p>
              <p className="text-[11px] text-on-inverse-muted">@{user?.username}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-on-inverse transition hover:bg-white/15 active:scale-95"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Cabeçalho da página */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-muted2">
              {isAdmin
                ? 'Gestão completa da plataforma'
                : 'Cadastro de alunos e suporte operacional'}
            </p>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]">
              {isAdmin ? 'Contas & Sistema' : 'Recepção / Portaria'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setIsCreating((open) => !open);
            }}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand transition active:scale-[0.99]"
          >
            {isCreating
              ? 'Fechar formulário'
              : isAdmin
                ? '＋ Nova conta'
                : '＋ Novo aluno'}
          </button>
        </div>
      </div>

      <main>{bodyContent}</main>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'done' | 'skip';
}) {
  const toneClass =
    tone === 'done'
      ? 'text-done'
      : tone === 'skip'
        ? 'text-skip'
        : 'text-ink';
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3.5">
      <p className={`font-display text-2xl font-extrabold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-xs font-bold text-muted2">{label}</p>
    </div>
  );
}

function CreateAccountForm({
  isAdmin,
  onCancel,
  onCreated,
}: {
  isAdmin: boolean;
  onCancel: () => void;
  onCreated: (created: UserSummary, temporaryPassword: string) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>('TRAINEE');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [username, setUsername] = useState('');
  const usernameTouchedRef = useRef(false);
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setFullName(value);
    if (!usernameTouchedRef.current) {
      setUsername(suggestUsernameFromName(value));
    }
  }

  async function refreshSuggestedUsername() {
    if (usernameTouchedRef.current || fullName.trim().length < 2) return;
    try {
      const res = await usersApi.suggestUsername(fullName.trim());
      if (!usernameTouchedRef.current) setUsername(res.username);
    } catch {
      /* mantém sugestão local */
    }
  }

  async function submit() {
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      return setFormError('Informe o nome completo.');
    }
    if (!isValidCpf(cpf)) {
      return setFormError('CPF inválido. Confira os 11 dígitos.');
    }
    const cleanUsername = username.trim() ? normalizeUsername(username) : '';
    if (cleanUsername && !isValidUsername(cleanUsername)) {
      return setFormError(
        'Apelido inválido (use 3 a 40 caracteres: letras, números, ponto, hífen ou _).',
      );
    }
    const strength = validateStrongPassword(password);
    if (!strength.valid) {
      return setFormError(strength.reason ?? 'Senha inicial fraca.');
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const targetRole: Role = isAdmin ? role : 'TRAINEE';
      const created = await usersApi.createUser({
        name: trimmedName,
        cpf,
        password,
        role: targetRole,
        ...(cleanUsername ? { username: cleanUsername } : {}),
      });
      await onCreated(created, password);
    } catch (error) {
      setFormError(describeError(error, 'Não foi possível criar a conta.'));
    } finally {
      setIsSaving(false);
    }
  }

  const check = passwordChecklist(password);
  const inputClass =
    'w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none';

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-extrabold">
          {isAdmin ? 'Cadastrar nova conta' : 'Cadastrar novo aluno'}
        </p>
        <span className="text-xs font-bold text-muted2">
          Troca de senha obrigatória no 1º acesso
        </span>
      </div>

      {isAdmin ? (
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Perfil da conta
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ADMIN_ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition ${
                  role === opt.value
                    ? 'border-brand bg-brand/10 text-brand-ink'
                    : 'border-line bg-paper text-muted hover:text-ink'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-muted2">
            {role === 'ADMIN'
              ? 'Conta administrativa exclusiva: exige CPF próprio (não pode compartilhar CPF com Personal ou Aluno).'
              : 'Mesmo CPF permitido para criar um perfil Personal e um perfil Aluno para a mesma pessoa (habilita troca rápida ⇄ dentro do app).'}
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-chip px-3 py-2 text-xs font-bold text-muted">
          O aluno nasce sem personal vinculado. Após o cadastro, basta passar o @apelido ao personal para receber o convite de vínculo.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
            Nome completo
          </label>
          <input
            value={fullName}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => void refreshSuggestedUsername()}
            placeholder="Ex.: Gabriel da Silva"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
            CPF
          </label>
          <input
            value={cpf}
            onChange={(e) => setCpf(formatCpfInput(e.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
            Apelido (@username)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-muted2">
              @
            </span>
            <input
              value={username}
              onChange={(e) => {
                usernameTouchedRef.current = true;
                setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
              }}
              placeholder="gabriel.silva"
              className={`${inputClass} pl-8`}
            />
          </div>
          <p className="text-[11px] font-semibold text-muted2">
            Sugestão automática. Usado no vínculo Personal ↔ Aluno sem expor o CPF.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
              Senha inicial temporária
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPassword(generateStrongPassword())}
                className="text-xs font-extrabold text-brand-ink hover:underline"
              >
                Gerar nova
              </button>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-xs font-extrabold text-muted hover:text-ink"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mín. 8 chars (letra, número e especial)"
            className={inputClass}
          />
          <p className="text-[11px] font-semibold text-muted2">
            <span className={check.minLength ? 'text-done' : ''}>8+ chars</span> ·{' '}
            <span className={check.hasLetter ? 'text-done' : ''}>letra</span> ·{' '}
            <span className={check.hasNumber ? 'text-done' : ''}>número</span> ·{' '}
            <span className={check.hasSpecial ? 'text-done' : ''}>especial</span>
          </p>
        </div>
      </div>

      {formError && <p className="text-sm font-semibold text-brand-ink">{formError}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border-2 border-line py-2.5 text-sm font-extrabold text-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSaving}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white shadow-brand disabled:opacity-60"
        >
          {isSaving ? 'Salvando…' : 'Criar conta'}
        </button>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  isAdmin,
  isSelf,
  onUpdated,
  onFeedback,
  onError,
}: {
  account: UserSummary;
  isAdmin: boolean;
  isSelf: boolean;
  onUpdated: (updated: UserSummary) => void;
  onFeedback: (message: string, copyValue?: string, copyLabel?: string) => void;
  onError: (message: string | null) => void;
}) {
  const [action, setAction] = useState<null | 'edit' | 'reset' | 'toggle'>(null);
  const [editName, setEditName] = useState(account.name);
  const [editUsername, setEditUsername] = useState(account.username);
  const [editCpf, setEditCpf] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = isAdmin || account.role === 'TRAINEE';
  const canReset =
    !isSelf && (isAdmin || account.role === 'TRAINEE' || account.role === 'PERSONAL');
  const canDeactivate =
    account.active &&
    !isSelf &&
    (isAdmin || account.role === 'TRAINEE' || account.role === 'PERSONAL');
  const canReactivate =
    !account.active && (isAdmin || account.role === 'TRAINEE');

  async function saveEdit() {
    if (editName.trim().length < 2) {
      return onError('O nome deve ter pelo menos 2 caracteres.');
    }
    const cleanUsername = normalizeUsername(editUsername);
    if (!isValidUsername(cleanUsername)) {
      return onError('Apelido inválido.');
    }
    if (editCpf.trim() && !isValidCpf(editCpf)) {
      return onError('CPF inválido. Confira os 11 dígitos.');
    }

    setBusy(true);
    onError(null);
    try {
      const updated = await usersApi.update(account.id, {
        name: editName.trim(),
        username: cleanUsername,
        ...(editCpf.trim() ? { cpf: editCpf } : {}),
      });
      onUpdated(updated);
      setEditCpf('');
      setAction(null);
      onFeedback(`Cadastro de ${updated.name} atualizado com sucesso.`);
    } catch (error) {
      onError(describeError(error, 'Não foi possível atualizar o cadastro.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    const strength = validateStrongPassword(resetPassword);
    if (!strength.valid) {
      return onError(strength.reason ?? 'Senha temporária fraca.');
    }
    setBusy(true);
    onError(null);
    try {
      const res = await usersApi.resetPassword(account.id, resetPassword);
      onUpdated(res.user);
      const handed = resetPassword;
      setResetPassword('');
      setAction(null);
      onFeedback(
        `Senha de ${account.name} redefinida! Senha temporária: ${handed} (troca obrigatória no próximo acesso).`,
        handed,
        'Copiar senha',
      );
    } catch (error) {
      onError(describeError(error, 'Não foi possível redefinir a senha.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmToggle() {
    setBusy(true);
    onError(null);
    try {
      const nextActive = !account.active;
      const updated = await usersApi.setActive(account.id, nextActive);
      onUpdated(updated);
      setAction(null);
      if (!nextActive && account.role === 'PERSONAL') {
        onFeedback(
          `Personal ${account.name} desativado. Acesso revogado e vínculos encerrados automaticamente (treinos dos alunos preservados).`,
        );
      } else {
        onFeedback(
          nextActive
            ? `Conta de ${account.name} reativada!`
            : `Conta de ${account.name} desativada e acesso revogado imediatamente.`,
        );
      }
    } catch (error) {
      onError(describeError(error, 'Não foi possível alterar o status da conta.'));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none';

  return (
    <div
      className={`rounded-2xl border border-line bg-card p-4 transition ${
        !account.active ? 'opacity-80' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <TraineeAvatar name={account.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-extrabold text-ink">{account.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${roleBadgeStyle(
                account.role,
              )}`}
            >
              {roleLabel(account.role)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                account.active ? 'bg-done-bg text-done' : 'bg-skip-bg text-skip'
              }`}
            >
              {account.active ? 'Ativo' : 'Desativado'}
            </span>
            {account.mustChangePassword && (
              <span className="rounded-full bg-gold-bg px-2 py-0.5 text-[10px] font-extrabold text-gold">
                Trocar senha
              </span>
            )}
            {isSelf && (
              <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-extrabold text-muted">
                Você
              </span>
            )}
          </div>
          <p className="mt-0.5 select-text truncate text-xs font-bold text-muted2">
            @{account.username} · CPF {account.cpfMasked ?? 'não cadastrado'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                onError(null);
                setEditName(account.name);
                setEditUsername(account.username);
                setEditCpf('');
                setAction((prev) => (prev === 'edit' ? null : 'edit'));
              }}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-ink hover:border-brand"
            >
              ✏️ Editar
            </button>
          )}
          {canReset && (
            <button
              type="button"
              onClick={() => {
                onError(null);
                setResetPassword(generateStrongPassword());
                setAction((prev) => (prev === 'reset' ? null : 'reset'));
              }}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-ink hover:border-brand"
            >
              🔑 Senha
            </button>
          )}
          {canDeactivate && (
            <button
              type="button"
              onClick={() => {
                onError(null);
                setAction((prev) => (prev === 'toggle' ? null : 'toggle'));
              }}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-skip hover:border-skip"
            >
              ⛔ Desativar
            </button>
          )}
          {canReactivate && (
            <button
              type="button"
              onClick={() => {
                onError(null);
                setAction((prev) => (prev === 'toggle' ? null : 'toggle'));
              }}
              className="rounded-xl border border-done bg-done-bg px-3 py-1.5 text-xs font-extrabold text-done"
            >
              ✅ Reativar
            </button>
          )}
          {!account.active && !canReactivate && !isAdmin && account.role === 'PERSONAL' && (
            <span className="text-[11px] font-bold text-muted2">
              Reativação via Admin
            </span>
          )}
        </div>
      </div>

      {action === 'edit' && (
        <div className="mt-3 space-y-2.5 rounded-2xl border border-line bg-paper p-3.5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Editar dados cadastrais
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome completo"
              className={inputClass}
            />
            <input
              value={editUsername}
              onChange={(e) =>
                setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
              }
              placeholder="Apelido"
              className={inputClass}
            />
            <input
              value={editCpf}
              onChange={(e) => setEditCpf(formatCpfInput(e.target.value))}
              inputMode="numeric"
              placeholder={
                account.cpfMasked
                  ? `Novo CPF (atual: ${account.cpfMasked})`
                  : 'Cadastrar CPF (000.000.000-00)'
              }
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAction(null)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveEdit()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {action === 'reset' && (
        <div className="mt-3 space-y-2.5 rounded-2xl border border-line bg-paper p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              Redefinir senha temporária
            </p>
            <button
              type="button"
              onClick={() => setResetPassword(generateStrongPassword())}
              className="text-xs font-extrabold text-brand-ink hover:underline"
            >
              Gerar outra
            </button>
          </div>
          <input
            type="text"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="Nova senha forte (8+ chars, letra, número e especial)"
            className={inputClass}
          />
          <p className="text-[11px] font-semibold text-muted2">
            O usuário precisará definir uma nova senha pessoal assim que entrar com esta senha temporária.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAction(null)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitReset()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {busy ? 'Aplicando…' : 'Confirmar redefinição'}
            </button>
          </div>
        </div>
      )}

      {action === 'toggle' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-3.5">
          <p className="text-xs font-bold text-ink">
            {account.active
              ? account.role === 'PERSONAL'
                ? `Desativar o personal ${account.name}? O acesso será revogado imediatamente e todos os vínculos ativos com alunos serão encerrados (os treinos dos alunos são preservados).`
                : `Desativar ${account.name}? O acesso ao app é bloqueado imediatamente, mantendo histórico e treinos preservados.`
              : `Reativar a conta de ${account.name}?`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction(null)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmToggle()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {busy
                ? 'Aguarde…'
                : account.active
                  ? 'Sim, desativar'
                  : 'Sim, reativar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
