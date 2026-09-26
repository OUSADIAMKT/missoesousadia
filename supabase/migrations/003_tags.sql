-- ---------------------------------------------------------------------------
-- Fase 3 — tags/etiquetas livres por missão (ex.: "post", "vídeo", "anúncio").
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 002. Bancos criados do
-- zero pelo `schema.sql` já vêm com esta coluna.
-- ---------------------------------------------------------------------------

-- Seguro rodar de novo: `if not exists` não reclama se a coluna já estiver lá.
alter table tarefas
  add column if not exists tags text[] not null default '{}';

comment on column tarefas.tags is
  'Etiquetas livres definidas pelo time (ex.: post, vídeo, anúncio) — sem lista fixa, digitadas na hora.';
