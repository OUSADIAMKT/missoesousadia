-- Missões da Ousadia — schema do banco compartilhado (Supabase/Postgres).
--
-- Rode este arquivo inteiro, uma vez, no SQL Editor do seu projeto Supabase
-- (https://supabase.com/dashboard/project/_/sql/new). Antes de rodar, edite a
-- seção "SEED" no final com os e-mails Gmail reais do time — sem isso,
-- ninguém consegue entrar (a lista de `usuarios` é a lista de acesso).
--
-- Espelha o modelo de dados de `src/lib/types.ts`, em snake_case/tabelas
-- normalizadas em vez de camelCase/objetos aninhados.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- USUÁRIOS — responde duas perguntas diferentes: "quem executa missões" (toda
-- linha) e "quem entra no sistema" (só as linhas com e-mail, ver RLS mais
-- abaixo). Vem antes das outras tabelas e das funções de acesso.
-- ---------------------------------------------------------------------------

-- `email` nulo = a pessoa executa missões mas NÃO entra no sistema (é o caso
-- da produtora de vídeo terceirizada): uma linha sem e-mail nunca casa com
-- `auth.jwt() ->> 'email'`, então a RLS a barra sozinha, sem regra extra.
-- O índice único continua valendo — o Postgres permite vários NULLs.
--
-- `vinculo` diz COMO o custo daquela pessoa se calcula, que é uma conta
-- diferente para cada forma de contratação (ver src/lib/types.ts). Nulo de
-- propósito enquanto ninguém classificou: o sistema prefere "não computável"
-- a um número inventado.
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  vinculo text check (vinculo in ('dono', 'socio', 'por_projeto', 'fornecedor', 'clt')),
  -- R$/mês: pacote fechado (fornecedor), salário (clt) ou pró-labore
  -- (dono/socio). Não se aplica a `por_projeto`, cujo custo é por entrega.
  custo_mensal numeric check (custo_mensal >= 0),
  horas_mensais numeric check (horas_mensais > 0),
  criado_em timestamptz not null default now(),
  -- Admin não pode se trancar do lado de fora: quem administra precisa entrar.
  constraint usuarios_admin_precisa_de_email check (papel <> 'admin' or email is not null)
);

-- Nome (na tabela `usuarios`) de quem está fazendo a requisição, a partir do
-- e-mail do login Google. `security definer` para não sofrer com a RLS da
-- própria tabela `usuarios` ao ser chamada de dentro de uma policy.
create or replace function nome_do_usuario_logado()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select nome from usuarios where email = auth.jwt() ->> 'email';
$$;

-- Trava de acesso: só quem está cadastrado em `usuarios` (a lista de e-mails
-- permitidos) passa. Usada em todas as políticas de RLS abaixo.
create or replace function is_team_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select nome_do_usuario_logado() is not null;
$$;

-- Só admin gerencia QUEM tem acesso (tabela `usuarios`) — o resto do sistema
-- (missões, clientes, projetos) continua aberto a qualquer membro do time,
-- não há motivo pra travar o dia a dia de um time pequeno por papel.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from usuarios where email = auth.jwt() ->> 'email' and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- ESTRUTURA E MISSÕES
-- ---------------------------------------------------------------------------

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_mensal numeric
);

create table projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_id uuid not null references clientes(id) on delete cascade
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  projeto_id uuid not null references projetos(id) on delete restrict,
  descricao text not null default '',
  data_registro date not null default current_date,
  data_inicio date not null,
  prazo_entrega date not null,
  prioridade text not null default 'Normal',
  complexidade text not null default 'Simples',
  horas_estimadas numeric,
  status text not null default 'A Fazer',
  quem text not null,
  criado_em timestamptz not null default now(),
  constraint tarefas_status_valido check (
    status in ('A Fazer','Em Andamento','Em Revisão','Aguardando Cliente','Ajustes Solicitados','Aprovado','Concluído')
  ),
  constraint tarefas_prioridade_valida check (prioridade in ('Baixa','Normal','Alta','Urgente')),
  constraint tarefas_complexidade_valida check (complexidade in ('Simples','Média','Complexa')),
  constraint tarefas_datas_validas check (data_inicio <= prazo_entrega)
);

create table historico_status (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  usuario text not null,
  data timestamptz not null default now()
);

-- `criado_por` vem sozinho de quem está logado (não é o cliente que manda) —
-- mesma lógica do histórico de status, mas forçado por trigger (ver
-- `forcar_criado_por()` mais abaixo) em vez de DEFAULT: um DEFAULT só entra
-- quando a coluna vem omitida do INSERT, então um `criado_por` explícito no
-- payload passaria direto.
create table bloqueios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  motivo text not null,
  criado_por text not null,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create unique index clientes_nome_unico on clientes (lower(nome));
create index on projetos (cliente_id);
create unique index projetos_nome_unico on projetos (cliente_id, lower(nome));
create index on tarefas (projeto_id);
create index on historico_status (tarefa_id);
create index on bloqueios (tarefa_id);

-- ---------------------------------------------------------------------------
-- HISTÓRICO DE STATUS: registrado automaticamente pelo banco (não pelo app),
-- assim é atômico com a própria mudança de status e não dá pra falsificar
-- quem fez o quê — o "usuário" vem do login (`nome_do_usuario_logado()`), não
-- de um parâmetro que o cliente poderia mandar errado.
-- ---------------------------------------------------------------------------

create or replace function registrar_historico_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into historico_status (tarefa_id, status_anterior, status_novo, usuario)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    coalesce(nome_do_usuario_logado(), 'Desconhecido')
  );
  return new;
end;
$$;

create trigger tarefas_historico_criacao
  after insert on tarefas
  for each row
  execute function registrar_historico_status();

create trigger tarefas_historico_mudanca_status
  after update of status on tarefas
  for each row
  when (old.status is distinct from new.status)
  execute function registrar_historico_status();

-- ---------------------------------------------------------------------------
-- BLOQUEIOS: `criado_por` também vem forçado pelo banco, não pelo app —
-- sobrescreve incondicionalmente o que vier no INSERT (mesmo se o cliente
-- mandar um `criado_por` explícito) com quem está logado de verdade.
-- ---------------------------------------------------------------------------

create or replace function forcar_criado_por()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.criado_por := coalesce(nome_do_usuario_logado(), 'Desconhecido');
  return new;
end;
$$;

create trigger bloqueios_forcar_criado_por
  before insert on bloqueios
  for each row
  execute function forcar_criado_por();

-- ---------------------------------------------------------------------------
-- RLS: um app interno de um time só — a regra é a mesma em toda tabela,
-- "está na lista de usuários permitidos? então lê e escreve tudo". Duas
-- exceções: `historico_status`, que só é escrito pelo trigger (security
-- definer, não sofre com RLS) — ninguém insere/altera/apaga histórico direto
-- pela API; e `usuarios`, onde todo time lê (pra saber quem é quem), mas só
-- admin adiciona/remove/edita quem tem acesso.
-- ---------------------------------------------------------------------------

alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table projetos enable row level security;
alter table tarefas enable row level security;
alter table historico_status enable row level security;
alter table bloqueios enable row level security;

create policy "time le usuarios" on usuarios
  for select using (is_team_member());
create policy "admin insere usuarios" on usuarios
  for insert with check (is_admin());
create policy "admin atualiza usuarios" on usuarios
  for update using (is_admin()) with check (is_admin());
create policy "admin remove usuarios" on usuarios
  for delete using (is_admin());
create policy "time acessa clientes" on clientes
  for all using (is_team_member()) with check (is_team_member());
create policy "time acessa projetos" on projetos
  for all using (is_team_member()) with check (is_team_member());
create policy "time acessa tarefas" on tarefas
  for all using (is_team_member()) with check (is_team_member());
create policy "time acessa historico" on historico_status
  for select using (is_team_member());
create policy "time acessa bloqueios" on bloqueios
  for all using (is_team_member()) with check (is_team_member());

-- ---------------------------------------------------------------------------
-- REALTIME: mudanças feitas por uma pessoa aparecem na tela das outras sem
-- precisar recarregar.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  usuarios, clientes, projetos, tarefas, historico_status, bloqueios;

-- ---------------------------------------------------------------------------
-- SEED — só o primeiro admin. O resto do time é adicionado depois direto
-- pela tela "Acesso do time" (só quem é admin vê essa opção) — sem precisar
-- editar este arquivo de novo. Troque "Admin" pelo nome de verdade se quiser
-- (dá pra editar direto na tabela `usuarios` pelo Table Editor do Supabase).
-- ---------------------------------------------------------------------------

insert into usuarios (nome, email, papel) values
  ('Admin', 'satoyiro@gmail.com', 'admin');

-- Mesmos clientes sugeridos e o projeto "Geral" que hoje vivem em
-- src/lib/types.ts (CLIENTES_SUGERIDOS) e src/lib/useEstrutura.ts.
do $$
declare
  nomes text[] := array[
    'Ekilibre','Clube EKL','FLIX','Fisioclin','Genera','Casa Sato','Storysell',
    'Foccus Running','Kairos','Gilcinete Silva','Brito Consultoria','Zeze Digital',
    'Lady Historia','Milena Carvalho','YBERA','Escola Ousadia','Interno / Ousadia'
  ];
  nome_cliente text;
  novo_cliente_id uuid;
begin
  foreach nome_cliente in array nomes loop
    insert into clientes (nome) values (nome_cliente) returning id into novo_cliente_id;
    insert into projetos (nome, cliente_id) values ('Geral', novo_cliente_id);
  end loop;
end $$;
