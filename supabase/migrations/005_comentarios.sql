-- ---------------------------------------------------------------------------
-- Fase 5 — comentários/discussão por missão, separado do histórico de status
-- e dos bloqueios.
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 004. Bancos criados do
-- zero pelo `schema.sql` já vêm com isso.
-- ---------------------------------------------------------------------------

create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  autor text not null,
  texto text not null,
  criado_em timestamptz not null default now()
);

create index if not exists comentarios_tarefa_id_idx on comentarios (tarefa_id);

alter table comentarios enable row level security;

drop policy if exists "time acessa comentarios" on comentarios;
create policy "time acessa comentarios" on comentarios
  for all using (is_team_member()) with check (is_team_member());

-- Mesma lógica de forcar_criado_por() (bloqueios/anexos), só que a coluna se
-- chama "autor" aqui — um comentário é sempre de quem está logado, nunca de
-- quem o payload disser.
create or replace function forcar_autor_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.autor := coalesce(nome_do_usuario_logado(), 'Desconhecido');
  return new;
end;
$$;

drop trigger if exists comentarios_forcar_autor on comentarios;
create trigger comentarios_forcar_autor
  before insert on comentarios
  for each row
  execute function forcar_autor_comentario();

alter publication supabase_realtime add table comentarios;
