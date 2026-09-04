# Missões da Ousadia

Central de Operações da Ousadia Marketing — quadro de missões (Kanban), estrutura Cliente → Projeto → Missão, fluxo de aprovação com o cliente, e (em construção) indicadores de performance do time.

Construído com Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 e [Supabase](https://supabase.com) (Postgres + Auth com Google + Realtime).

## Como rodar localmente

1. `npm install`
2. Crie um projeto no [supabase.com](https://supabase.com) e configure o login com Google (Authentication → Providers → Google — precisa de um OAuth Client ID/Secret do Google Cloud Console).
3. Rode `supabase/schema.sql` uma vez no SQL Editor do seu projeto Supabase, editando antes a seção `SEED` com os e-mails reais do time (só quem está lá consegue entrar).
4. Copie `.env.local.example` para `.env.local` e preencha com a Project URL e a anon key do seu projeto (Project Settings → API).
5. `npm run dev` e abra [http://localhost:3000](http://localhost:3000).

## Comandos

- `npm run dev` — servidor de desenvolvimento (Turbopack)
- `npm run build` — build de produção
- `npm run start` — roda o build de produção
- `npm run lint` — ESLint

## Saiba mais

A arquitetura completa (modelo de dados, fluxo de dados entre hooks e componentes, convenções de estilo) está documentada em [`CLAUDE.md`](./CLAUDE.md).
