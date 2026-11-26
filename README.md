# meu-treino-front

Frontend do app **Ritmo** — **Next.js 14 (App Router) + Tailwind + PWA**, mobile-first com suporte a tema claro/escuro e modo offline.

Consome a API `../meu-treino-back` via proxy `/api` same-origin. Dois papéis: **TRAINEE** (aluno) e **ADMIN** (personal).

---

## Rodar local
```bash
cp .env.example .env.local     # API_UPSTREAM=http://localhost:3000/api
npm install
npm run dev                    # http://localhost:3001
```
> O backend precisa estar rodando (`../meu-treino-back`, porta 3000). Faça login digitando apenas o PIN definido no seed (`ADMIN_PIN` / `TRAINEE_PIN`).

## Verificação e build de produção
```bash
npm run lint                   # tsc --noEmit + verificação de contraste/tema (lint:theme)
npm run build && npm run start
```

---

## Estrutura
```
app/
  (auth)/login/                 # login por PIN (teclado numérico + suporte a teclado físico)
  (trainee)/
    treino/                     # home do aluno: semana, programa/desafio atual, treino recomendado
    treino/meus/                # lista de treinos do programa e avulsos
    treino/sessao/[workoutId]/  # execução do treino (séries, carga, tempo, timer, modo offline)
    treino/historico/           # calendário mensal e histórico de sessões
    treino/conquistas/          # medalhas e compartilhamento de conquistas
    treino/recados/             # recados do personal
    treino/fotos/               # fotos de progresso e comparador antes × depois
    treino/exercicio/[id]/      # detalhe do exercício (GIF, instruções, estatísticas, alternativas)
  (admin)/dashboard/
    (page)                      # resumo geral, alertas, jornadas em andamento e progressão
    treinos/                    # criar/editar/reordenar treinos e direcionar alunos
    programas/                  # programas contínuos, mesociclos e desafios
    exercicios/                 # catálogo com filtros, busca, favoritos e "+ Treino"
    alunos/                     # perfil do aluno (resumo, treinos, recados, fotos, medalhas)
    historico/                  # histórico geral com filtros e exportação CSV
    evolucao/                   # gráficos de frequência, carga, trocas e pulos
  error.tsx / not-found.tsx     # boundaries de erro e 404
  manifest.ts                   # manifest PWA
  layout.tsx globals.css
components/{ui,workout,dashboard,trainee,programs,layout}/
lib/
  api/        # client HTTP (cookie httpOnly + proxy /api) + cache em memória + endpoints
  auth/       # AuthProvider (validação via /auth/me + limpeza de sessão) e RequireRole
  offline/    # fila offline (IndexedDB outbox) + rascunho de sessão
  programs/   # regras de programas, conquistas e card compartilhável
  types/      # contratos tipados com o backend
public/
  icons/      # ícones PWA (192/512/maskable/apple)
  sw.js       # service worker (app shell + /_next/static + Web Push; nunca cacheia /api)
```

## Autenticação
Login apenas por PIN (`POST /api/auth/login`) → o backend identifica o usuário e define o cookie `mt_token` (`HttpOnly; SameSite=Lax`, `Secure` em produção). Como todas as requisições passam pelo proxy `/api` em `next.config.mjs`, o cookie permanece first-party em qualquer navegador (inclusive iOS Safari PWA).

## Tema Claro / Escuro
Todas as cores usam tokens semânticos em `app/globals.css` e `tailwind.config.ts`. Antes de cada build (`prebuild`), `scripts/check-theme-classes.mjs` (`npm run lint:theme`) impede combinações de classes que quebram o contraste no modo escuro.

## PWA e Offline
- `app/manifest.ts` gera `/manifest.webmanifest` (`display: standalone`).
- `public/sw.js` cacheia o app shell e estáticos de `/_next/static/*`; chamadas `/api` nunca são cacheadas pelo SW (a sincronização offline de marcações vive em `lib/offline/queue.ts`).
- Safe-areas (`.safe-top` / `.safe-bottom`) garantem espaçamento adequado para Dynamic Island e barra inferior no iOS standalone.

---

## Deploy — Vercel / Docker
1. Configure `API_UPSTREAM` apontando para a URL da API (ex.: `https://api.seu-dominio.com/api`).
2. Ajuste `CORS_ORIGIN` no backend para o domínio público do frontend.
3. No Docker, `API_UPSTREAM` pode ser informado em build (`--build-arg API_UPSTREAM=...`) ou runtime.
