-- ---------------------------------------------------------------------------
-- Fase 7 — página pública de aprovação do cliente, sem login.
--
-- Cada cliente ganha um link único (`/aprovar/<token>`) que mostra as missões
-- em andamento dele e deixa aprovar ou pedir ajuste direto ali. Como não tem
-- sessão do Supabase Auth nessa página (o visitante não é um `usuario`), o
-- acesso não passa pela RLS normal (`is_team_member()`) — passa por 3 funções
-- `security definer`, chamadas pelo role `anon`, que validam o token e só
-- devolvem/alteram dado do cliente daquele token. É o mesmo padrão de
-- "function definida com privilégio próprio" que `is_team_member()`/
-- `is_admin()` já usam, só que pro lado de fora em vez de pro time.
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 006. Bancos criados do
-- zero pelo `schema.sql` já vêm com isso.
-- ---------------------------------------------------------------------------

alter table clientes
  add column if not exists token_aprovacao uuid unique not null default gen_random_uuid();

comment on column clientes.token_aprovacao is
  'Token do link público de aprovação (/aprovar/<token>). Regenerável a qualquer momento pelo time — o link antigo para de funcionar.';

-- ---------------------------------------------------------------------------
-- "Quem fez isso" nas duas trilhas que a aprovação do cliente também grava
-- (histórico de status e comentário do motivo do ajuste) precisa dizer
-- "Cliente — Nome", não "Desconhecido". As funções já existiam — só passam a
-- checar primeiro uma GUC de sessão (`app.ator_externo`) que
-- aprovacao_responder() seta antes de gravar; nula/ausente em qualquer outro
-- fluxo (RLS normal do app), então o comportamento de sempre não muda.
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
    coalesce(nullif(current_setting('app.ator_externo', true), ''), nome_do_usuario_logado(), 'Desconhecido')
  );
  return new;
end;
$$;

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

-- ---------------------------------------------------------------------------
-- RPCs públicas (grant explícito pro role anon — nenhuma outra tabela/função
-- deste sistema é acessível sem login).
-- ---------------------------------------------------------------------------

-- Valida o token e devolve só o nome do cliente (cabeçalho da página). Token
-- inválido = zero linhas, não erro — a página trata como "link inválido".
create or replace function aprovacao_cliente(p_token uuid)
returns table(id uuid, nome text)
language sql
security definer
set search_path = public
stable
as $$
  select id, nome from clientes where token_aprovacao = p_token;
$$;

-- Missões do cliente daquele token, exceto as já arquivadas como Concluído.
-- Nunca inclui custo, vínculo, quem executa, bloqueios, comentários internos
-- ou anexos — só o que o cliente precisa pra entender e aprovar a entrega.
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

-- Aprovar ou pedir ajuste. Só aceita agir sobre uma missão que: pertence ao
-- cliente do token (nunca um id de outro cliente) e está, agora, em
-- "Aguardando Cliente" (não dá pra aprovar algo que já mudou de status por
-- outro caminho enquanto a página estava aberta).
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
grant execute on function aprovacao_responder(uuid, uuid, text, text) to anon;
