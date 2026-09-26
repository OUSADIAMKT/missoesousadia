-- ---------------------------------------------------------------------------
-- Fase 6 — apontamento manual de horas reais por missão. Destrava as métricas
-- de produtividade real em performance-metrics.ts (precisaoEstimativa,
-- produtividadeReal), que hoje devolvem `{ disponivel: false }` por falta
-- dessa fonte.
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 005. Bancos criados do
-- zero pelo `schema.sql` já vêm com isso.
-- ---------------------------------------------------------------------------

-- `usuario` NÃO é forçado a partir do login (diferente de bloqueios/anexos/
-- comentários): é digitado/selecionado como o campo "quem" da própria missão,
-- porque quem executou pode não ter e-mail cadastrado (ex.: a produtora de
-- vídeo terceirizada) — nesse caso outra pessoa do time lança as horas dela.
create table if not exists apontamentos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario text not null,
  horas numeric not null check (horas > 0),
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

create index if not exists apontamentos_tarefa_id_idx on apontamentos (tarefa_id);

alter table apontamentos enable row level security;

drop policy if exists "time acessa apontamentos" on apontamentos;
create policy "time acessa apontamentos" on apontamentos
  for all using (is_team_member()) with check (is_team_member());

alter publication supabase_realtime add table apontamentos;
