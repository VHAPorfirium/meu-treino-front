# meu-treino-front

Frontend do app de treino — **Next.js 14 (App Router) + Tailwind + PWA**, mobile-first.

Consome a API `../meu-treino-back`. 2 papéis: **TRAINEE** (aluna) e **ADMIN**.

> Estilo atual é um tema neutro (dark) tokenizado no Tailwind, pronto pra receber o design definitivo.

---

## Rodar local
```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3000/api
npm install
npm run dev                    # http://localhost:3001
```
> O backend precisa estar rodando (`../meu-treino-back`, porta 3000). Faça login com os PINs definidos no seed (`ADMIN_PIN` / `TRAINEE_PIN`).

## Build de produção
```bash
npm run build && npm run start
```

---

## Estrutura
```
app/
  (auth)/login/               # login por PIN (teclado numérico + toggle Aluna/Admin)
  (trainee)/
    treino/                   # treino do dia: marcar DONE/SKIPPED/REPLACED, carga, nota
    treino/historico/         # histórico da aluna
    treino/exercicio/[id]/    # detalhe do exercício (GIF, instruções, alternativas)
  (admin)/dashboard/
    (page)                    # resumo (frequência, mais pulados)
    treinos/                  # criar treino + adicionar exercícios
    exercicios/               # catálogo com filtro por grupo + busca
    evolucao/                 # gráficos: frequência, carga, trocas, pulos
  manifest.ts                 # manifest PWA
  layout.tsx globals.css
components/{ui,workout,dashboard,layout}/
lib/
  api/     # client (fetch + JWT) + endpoints tipados
  auth/    # AuthProvider (cookie), guards por papel
  types/   # tipos compartilhados com o backend
public/
  icons/   # ícones PWA (192/512/maskable/apple)
  sw.js    # service worker (app shell offline; não cacheia /api)
```

## Autenticação
Login por papel + PIN → JWT guardado em cookie (`SameSite=Lax`, 30 dias). Guards client-side (`RequireRole`) só cuidam da navegação; a autorização real é do backend.

## PWA
- `app/manifest.ts` gera `/manifest.webmanifest`.
- `public/sw.js` cacheia o app shell (abre offline); chamadas `/api` nunca são cacheadas.
- Instalável no celular: abrir no Chrome/Safari → "Adicionar à tela inicial".

---

## Deploy — Vercel
1. Importe o repositório `meu-treino-front` na Vercel.
2. Configure a env `NEXT_PUBLIC_API_URL` = URL pública do backend (ex: `https://SEU-BACKEND/api`).
3. Deploy. Ajuste o `CORS_ORIGIN` no backend para o domínio da Vercel.

## Notas
- Imagens (GIF/thumb) vêm do GitHub raw ou do Supabase Storage — domínios liberados em `next.config.mjs`.
- `next/image` usa `unoptimized` nesses casos (GIFs animados) para não quebrar a animação.
