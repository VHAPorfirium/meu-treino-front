/**
 * Utilitários de validação e máscara para CPF, senha forte e `username`
 * (`primeiro.ultimo`), espelhando exatamente as regras do backend (`v1.1`).
 */

const PORTUGUESE_PREPOSITIONS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** Remove tudo que não for dígito numérico. */
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Formata entrada de CPF como `000.000.000-00` (máximo 11 dígitos). */
export function formatCpfInput(raw: string): string {
  const digits = normalizeCpf(raw).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Formata o campo único de login:
 * - Se o usuário digita apenas números/pontuação de CPF → aplica máscara `000.000.000-00`.
 * - Se o usuário digita letras (fallback legado v1.0, ex.: `admin`, `ninfa`) → mantém texto livre.
 */
export function formatLoginIdentifierInput(raw: string): string {
  if (!raw) return '';
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(raw);
  if (hasLetters) {
    return raw.replace(/\s+/g, '').slice(0, 40);
  }
  if (/^[\d.\-\s/]+$/.test(raw)) {
    return formatCpfInput(raw);
  }
  return raw.slice(0, 40);
}

/** Retorna true quando o valor informado parece ser um CPF (apenas dígitos/pontuação). */
export function isCpfLikeInput(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && /^[\d.\-\s/]+$/.test(trimmed);
}

/** Valida CPF brasileiro (11 dígitos, rejeita repetições e valida dígitos módulo 11). */
export function isValidCpf(raw: string): boolean {
  const digits = normalizeCpf(raw);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calcDigit(9) === Number(digits[9]) && calcDigit(10) === Number(digits[10])
  );
}

export interface PasswordChecklist {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  valid: boolean;
}

/** Avaliação granular da política de senha forte (8+ chars, letra, número, especial). */
export function passwordChecklist(password: string): PasswordChecklist {
  const minLength = password.length >= 8 && password.length <= 128;
  const hasLetter = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/.test(password);
  return {
    minLength,
    hasLetter,
    hasNumber,
    hasSpecial,
    valid: minLength && hasLetter && hasNumber && hasSpecial,
  };
}

export function validateStrongPassword(
  password: string,
): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'A senha deve ter no mínimo 8 caracteres' };
  }
  if (password.length > 128) {
    return { valid: false, reason: 'A senha deve ter no máximo 128 caracteres' };
  }
  const check = passwordChecklist(password);
  if (!check.hasLetter) {
    return { valid: false, reason: 'Inclua pelo menos 1 letra' };
  }
  if (!check.hasNumber) {
    return { valid: false, reason: 'Inclua pelo menos 1 número' };
  }
  if (!check.hasSpecial) {
    return {
      valid: false,
      reason: 'Inclua pelo menos 1 caractere especial (ex.: !@#$%)',
    };
  }
  return { valid: true };
}

/** Gera uma senha temporária forte e legível (10 chars, sem caracteres ambíguos). */
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%&*!?';
  const all = upper + lower + digits + special;

  const randomIndex = (max: number): number => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  const chars = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    special[randomIndex(special.length)],
  ];
  while (chars.length < 10) {
    chars.push(all[randomIndex(all.length)]);
  }
  // Embaralha Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Normaliza apelido de usuário: minúsculo, sem acentos, apenas `[a-z0-9._-]`. */
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/[._-]{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 40);
}

export function isValidUsername(raw: string): boolean {
  const normalized = normalizeUsername(raw);
  return (
    normalized.length >= 3 &&
    normalized.length <= 40 &&
    /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(normalized)
  );
}

/** Sugere apelido `primeiro.ultimo` removendo acentos e preposições portuguesas. */
export function suggestUsernameFromName(fullName: string): string {
  const tokens = fullName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].slice(0, 36);

  const meaningful = tokens.filter(
    (t, idx) =>
      idx === 0 || idx === tokens.length - 1 || !PORTUGUESE_PREPOSITIONS.has(t),
  );
  return normalizeUsername(`${meaningful[0]}.${meaningful[meaningful.length - 1]}`).slice(0, 36);
}
