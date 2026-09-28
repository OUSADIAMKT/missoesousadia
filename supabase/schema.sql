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
  valor_mensal numeric,
  -- Token do link público de aprovação (/aprovar/<token>, ver seção
  -- APROVAÇÃO DO CLIENTE mais abaixo). Regenerável a qualquer momento pelo
  -- time — o link antigo para de funcionar.
  token_aprovacao uuid unique not null default gen_random_uuid()
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
  -- R$ combinados com quem executa esta missão. Só faz sentido para responsável
  -- de vínculo `por_projeto`: quem tem custo fixo mensal é rateado pelas
  -- entregas do mês, não lançado missão a missão.
  custo_execucao numeric check (custo_execucao >= 0),
  -- Etiquetas livres definidas pelo time (ex.: post, vídeo, anúncio) — sem
  -- lista fixa, digitadas na hora (ver migrations/003_tags.sql).
  tags text[] not null default '{}',
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

-- Arquivos anexados à missão (briefing, arte, referência), guardados no
-- Supabase Storage (bucket "anexos", ver seção STORAGE mais abaixo).
create table anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  nome text not null,
  -- Caminho dentro do bucket "anexos" — é a partir dele que o app gera o
  -- link de download/remoção no Storage.
  caminho text not null,
  tamanho bigint,
  tipo text,
  criado_por text not null,
  criado_em timestamptz not null default now()
);

-- Discussão da missão, separada do histórico de status e dos bloqueios —
-- um lugar para tirar dúvida sem precisar mudar o status.
create table comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  autor text not null,
  texto text not null,
  criado_em timestamptz not null default now()
);

-- Apontamento manual de horas reais por missão — alimenta as métricas de
-- produtividade real em performance-metrics.ts. `usuario` não é forçado pelo
-- login (diferente de bloqueios/anexos/comentários): segue o mesmo padrão do
-- campo "quem" da missão, porque quem executou pode não ter e-mail cadastrado
-- (ex.: a produtora de vídeo terceirizada) — outra pessoa do time lança por ela.
create table apontamentos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario text not null,
  horas numeric not null check (horas > 0),
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

create unique index clientes_nome_unico on clientes (lower(nome));
create index on projetos (cliente_id);
create unique index projetos_nome_unico on projetos (cliente_id, lower(nome));
create index on tarefas (projeto_id);
create index on historico_status (tarefa_id);
create index on bloqueios (tarefa_id);
create index on anexos (tarefa_id);
create index on comentarios (tarefa_id);
create index on apontamentos (tarefa_id);

-- ---------------------------------------------------------------------------
-- HISTÓRICO DE STATUS: registrado automaticamente pelo banco (não pelo app),
-- assim é atômico com a própria mudança de status e não dá pra falsificar
-- quem fez o quê — o "usuário" vem do login (`nome_do_usuario_logado()`), não
-- de um parâmetro que o cliente poderia mandar errado.
-- ---------------------------------------------------------------------------

-- `app.ator_externo` é uma GUC de sessão que aprovacao_responder() seta antes
-- de gravar (ver seção APROVAÇÃO DO CLIENTE) — é como "Cliente — Nome" entra
-- no histórico em vez de "Desconhecido". Nula em qualquer outro fluxo, então
-- não muda nada do comportamento de sempre.
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
    coalesce(nullif(current_setting('app.ator_externo', true), ''), nome_do_usuario_logado(), 'Desconhecido')
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

-- Mesma trava para anexos: quem enviou o arquivo vem do login, não do payload.
create trigger anexos_forcar_criado_por
  before insert on anexos
  for each row
  execute function forcar_criado_por();

-- ---------------------------------------------------------------------------
-- COMENTÁRIOS: mesma lógica de forcar_criado_por() acima, só que a coluna se
-- chama "autor" aqui — um comentário é sempre de quem está logado, ou do
-- cliente respondendo pela página pública de aprovação (mesma GUC
-- app.ator_externo de registrar_historico_status() acima).
-- ---------------------------------------------------------------------------

create or replace function forcar_autor_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.autor := coalesce(nullif(current_setting('app.ator_externo', true), ''), nome_do_usuario_logado(), 'Desconhecido');
  return new;
end;
$$;

create trigger comentarios_forcar_autor
  before insert on comentarios
  for each row
  execute function forcar_autor_comentario();

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
alter table anexos enable row level security;
alter table comentarios enable row level security;
alter table apontamentos enable row level security;

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
create policy "time acessa anexos" on anexos
  for all using (is_team_member()) with check (is_team_member());
create policy "time acessa comentarios" on comentarios
  for all using (is_team_member()) with check (is_team_member());
create policy "time acessa apontamentos" on apontamentos
  for all using (is_team_member()) with check (is_team_member());

-- ---------------------------------------------------------------------------
-- STORAGE: bucket privado para os anexos das missões. Acesso só via RLS de
-- storage.objects (mesma regra "time inteiro lê e escreve" do resto do app),
-- nunca por URL pública direta.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

create policy "time le anexos no storage" on storage.objects
  for select using (bucket_id = 'anexos' and public.is_team_member());
create policy "time envia anexos no storage" on storage.objects
  for insert with check (bucket_id = 'anexos' and public.is_team_member());
create policy "time remove anexos no storage" on storage.objects
  for delete using (bucket_id = 'anexos' and public.is_team_member());

-- ---------------------------------------------------------------------------
-- REALTIME: mudanças feitas por uma pessoa aparecem na tela das outras sem
-- precisar recarregar.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  usuarios, clientes, projetos, tarefas, historico_status, bloqueios, anexos, comentarios,
  apontamentos;

-- ---------------------------------------------------------------------------
-- APROVAÇÃO DO CLIENTE: página pública em /aprovar/<token> (ver
-- src/app/aprovar/[token]/page.tsx), sem login. Como o visitante não é um
-- `usuario` autenticado, RLS normal não serve — o acesso passa por 3 funções
-- `security definer` chamadas pelo role `anon`, que validam o token contra
-- `clientes.token_aprovacao` e só devolvem/alteram dado daquele cliente.
-- Nunca expõe custo, vínculo, quem executa, bloqueios, comentários internos
-- ou anexos — só o necessário pra entender e aprovar a entrega.
-- ---------------------------------------------------------------------------

create or replace function aprovacao_cliente(p_token uuid)
returns table(id uuid, nome text)
language sql
security definer
set search_path = public
stable
as $$
  select id, nome from clientes where token_aprovacao = p_token;
$$;

create or replace function aprovacao_missoes(p_token uuid)
returns table(
  id uuid,
  titulo text,
  descricao text,
  prazo_entrega date,
  status text,
  tags text[],
  projeto_nome text
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.titulo, t.descricao, t.prazo_entrega, t.status, t.tags, pr.nome
  from tarefas t
  join projetos pr on pr.id = t.projeto_id
  join clientes c on c.id = pr.cliente_id
  where c.token_aprovacao = p_token
    and t.status <> 'Concluído'
  order by t.prazo_entrega asc;
$$;

-- Anexos de UMA missão, só se ela pertencer ao cliente do token — o cliente
-- precisa ver o arquivo de verdade pra aprovar de verdade, não só um título.
-- O download em si (link assinado do Storage) é gerado pela rota
-- /api/aprovacao/anexo do app, não daqui: a API do Storage não tem uma
-- função SQL pra assinar URL. Essa rota usa a service_role key só ali, e só
-- depois de chamar esta função pra confirmar que o anexo é mesmo desse
-- cliente. Ver src/app/api/aprovacao/anexo/route.ts.
create or replace function aprovacao_anexos(p_token uuid, p_tarefa_id uuid)
returns table(id uuid, nome text, caminho text, tamanho bigint, tipo text)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.nome, a.caminho, a.tamanho, a.tipo
  from anexos a
  join tarefas t on t.id = a.tarefa_id
  join projetos pr on pr.id = t.projeto_id
  join clientes c on c.id = pr.cliente_id
  where a.tarefa_id = p_tarefa_id
    and c.token_aprovacao = p_token;
$$;

-- Só aceita agir sobre uma missão que pertence ao cliente do token e está,
-- agora, em "Aguardando Cliente" — nunca outro cliente, nunca um status que
-- já mudou por outro caminho enquanto a página estava aberta.
create or replace function aprovacao_responder(
  p_token uuid,
  p_tarefa_id uuid,
  p_acao text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_cliente_nome text;
  v_status_atual text;
begin
  if p_acao not in ('aprovar', 'ajustes') then
    raise exception 'Ação inválida.';
  end if;
  if p_acao = 'ajustes' and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Descreva o que precisa ajustar.';
  end if;

  select id, nome into v_cliente_id, v_cliente_nome
  from clientes where token_aprovacao = p_token;
  if v_cliente_id is null then
    raise exception 'Link inválido.';
  end if;

  select t.status into v_status_atual
  from tarefas t
  join projetos pr on pr.id = t.projeto_id
  where t.id = p_tarefa_id and pr.cliente_id = v_cliente_id;
  if v_status_atual is null then
    raise exception 'Missão não encontrada.';
  end if;
  if v_status_atual <> 'Aguardando Cliente' then
    raise exception 'Essa missão não está mais aguardando aprovação.';
  end if;

  perform set_config('app.ator_externo', 'Cliente — ' || v_cliente_nome, true);

  if p_acao = 'aprovar' then
    update tarefas set status = 'Aprovado' where id = p_tarefa_id;
  else
    update tarefas set status = 'Ajustes Solicitados' where id = p_tarefa_id;
    insert into comentarios (tarefa_id, texto) values (p_tarefa_id, p_motivo);
  end if;
end;
$$;

grant execute on function aprovacao_cliente(uuid) to anon;
grant execute on function aprovacao_missoes(uuid) to anon;
grant execute on function aprovacao_anexos(uuid, uuid) to anon;
grant execute on function aprovacao_responder(uuid, uuid, text, text) to anon;

-- ---------------------------------------------------------------------------
-- SEED — só o primeiro admin. O resto do time é adicionado depois direto
-- pela tela "Acesso do time" (só quem é admin vê essa opção) — sem precisar
-- editar este arquivo de novo. Troque "Admin" pelo nome de verdade se quiser
-- (dá pra editar direto na tabela `usuarios` pelo Table Editor do Supabase).
-- ---------------------------------------------------------------------------

-- TROQUE o e-mail abaixo pelo Gmail com que VOCÊ vai entrar. Se ele estiver
-- errado, ninguém consegue logar: esta linha é a lista de acesso inicial, e
-- só um admin pode adicionar os outros depois (pela tela "Time e custos").
insert into usuarios (nome, email, papel) values
  ('Admin', 'satoyiro@gmail.com', 'admin')
on conflict (email) do nothing;

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
