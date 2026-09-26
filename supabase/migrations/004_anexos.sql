-- ---------------------------------------------------------------------------
-- Fase 4 — anexos nas missões (briefing, arte, referência), guardados no
-- Supabase Storage.
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 003. Bancos criados do
-- zero pelo `schema.sql` já vêm com isso.
-- ---------------------------------------------------------------------------

-- Bucket privado: acesso só via RLS de storage.objects abaixo, nunca por URL
-- pública direta — mesma regra de "time inteiro lê e escreve" do resto do app.
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

create table if not exists anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  nome text not null,
  -- Caminho dentro do bucket "anexos" (ex.: "<tarefa_id>/<uid>-arquivo.pdf") —
  -- é a partir dele que o app gera o link de download/remoção no Storage.
  caminho text not null,
  tamanho bigint,
  tipo text,
  criado_por text not null,
  criado_em timestamptz not null default now()
);

create index if not exists anexos_tarefa_id_idx on anexos (tarefa_id);

alter table anexos enable row level security;

drop policy if exists "time acessa anexos" on anexos;
create policy "time acessa anexos" on anexos
  for all using (is_team_member()) with check (is_team_member());

-- Mesma trava de "quem fez isso vem do login" que já vale para bloqueios:
-- reaproveita a função forcar_criado_por() (genérica, olha a coluna
-- criado_por) já criada em schema.sql.
drop trigger if exists anexos_forcar_criado_por on anexos;
create trigger anexos_forcar_criado_por
  before insert on anexos
  for each row
  execute function forcar_criado_por();

alter publication supabase_realtime add table anexos;

-- RLS do Storage: bucket "anexos" só é legível/gravável/removível por quem
-- está em `usuarios` — mesma regra de acesso do resto do sistema.
drop policy if exists "time le anexos no storage" on storage.objects;
create policy "time le anexos no storage" on storage.objects
  for select using (bucket_id = 'anexos' and public.is_team_member());

drop policy if exists "time envia anexos no storage" on storage.objects;
create policy "time envia anexos no storage" on storage.objects
  for insert with check (bucket_id = 'anexos' and public.is_team_member());

drop policy if exists "time remove anexos no storage" on storage.objects;
create policy "time remove anexos no storage" on storage.objects
  for delete using (bucket_id = 'anexos' and public.is_team_member());
