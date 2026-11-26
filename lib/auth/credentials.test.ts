import { describe, expect, it } from 'vitest';
import {
  formatCpfInput,
  formatLoginIdentifierInput,
  generateStrongPassword,
  isValidCpf,
  isValidUsername,
  normalizeCpf,
  passwordChecklist,
  suggestUsernameFromName,
  validateStrongPassword,
} from './credentials';

describe('credentials — CPF, senha forte e username', () => {
  it('formata CPF progressivamente no padrão 000.000.000-00', () => {
    expect(formatCpfInput('529')).toBe('529');
    expect(formatCpfInput('529982')).toBe('529.982');
    expect(formatCpfInput('529982247')).toBe('529.982.247');
    expect(formatCpfInput('52998224725')).toBe('529.982.247-25');
    expect(formatCpfInput('52998224725999')).toBe('529.982.247-25');
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });

  it('formata campo de login como CPF quando numérico e preserva apelido legado quando alfabético', () => {
    expect(formatLoginIdentifierInput('52998224725')).toBe('529.982.247-25');
    expect(formatLoginIdentifierInput('victor.hugo')).toBe('victor.hugo');
    expect(formatLoginIdentifierInput('admin')).toBe('admin');
  });

  it('valida CPF com módulo 11 e rejeita repetições e dígitos incorretos', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);

    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-26')).toBe(false);
    expect(isValidCpf('12345')).toBe(false);
  });

  it('valida senha forte (8+ chars, letra, número e caractere especial)', () => {
    expect(validateStrongPassword('Treino@2026')).toEqual({ valid: true });
    expect(passwordChecklist('Treino@2026')).toEqual({
      minLength: true,
      hasLetter: true,
      hasNumber: true,
      hasSpecial: true,
      valid: true,
    });

    expect(validateStrongPassword('Ab@1').valid).toBe(false);
    expect(validateStrongPassword('12345678@').valid).toBe(false);
    expect(validateStrongPassword('SenhaForte@').valid).toBe(false);
    expect(validateStrongPassword('SenhaForte1').valid).toBe(false);
  });

  it('gera senhas temporárias sempre válidas na política forte', () => {
    for (let i = 0; i < 20; i++) {
      const generated = generateStrongPassword();
      expect(generated.length).toBe(10);
      expect(validateStrongPassword(generated).valid).toBe(true);
    }
  });

  it('sugere e valida username primeiro.ultimo sem acentos nem preposições', () => {
    expect(suggestUsernameFromName('Gabriel da Silva')).toBe('gabriel.silva');
    expect(suggestUsernameFromName('João Pedro de Oliveira')).toBe('joao.oliveira');
    expect(suggestUsernameFromName('Ninfa')).toBe('ninfa');
    expect(isValidUsername('gabriel.silva')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
  });
});
