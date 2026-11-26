import { describe, expect, it } from 'vitest';
import { roleHome, roleLabel, userHome } from './storage';

describe('storage — roteamento e rótulos dos 4 perfis (v2.0)', () => {
  it('mapeia cada papel para sua rota inicial correta', () => {
    expect(roleHome('ADMIN')).toBe('/admin');
    expect(roleHome('RECEPTION')).toBe('/recepcao');
    expect(roleHome('PERSONAL')).toBe('/dashboard');
    expect(roleHome('TRAINEE')).toBe('/treino');
  });

  it('redireciona qualquer perfil para /trocar-senha quando mustChangePassword = true', () => {
    expect(
      userHome({
        userId: 'u1',
        role: 'PERSONAL',
        name: 'Victor Personal',
        username: 'victor.personal',
        mustChangePassword: true,
      }),
    ).toBe('/trocar-senha');

    expect(
      userHome({
        userId: 'u2',
        role: 'RECEPTION',
        name: 'Portaria',
        username: 'portaria',
        mustChangePassword: false,
      }),
    ).toBe('/recepcao');
  });

  it('retorna rótulos amigáveis em pt-BR para os 4 perfis', () => {
    expect(roleLabel('ADMIN')).toBe('Administrador');
    expect(roleLabel('RECEPTION')).toBe('Portaria');
    expect(roleLabel('PERSONAL')).toBe('Personal');
    expect(roleLabel('TRAINEE')).toBe('Aluno');
  });
});
