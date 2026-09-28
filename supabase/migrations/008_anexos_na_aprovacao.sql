-- ---------------------------------------------------------------------------
-- Fase 8 — anexos visíveis na página pública de aprovação (o cliente precisa
-- ver o arquivo de verdade pra aprovar de verdade, não só ler um título).
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 007. Bancos criados do
-- zero pelo `schema.sql` já vêm com isso.
-- ---------------------------------------------------------------------------

-- Lista os anexos de UMA missão, só se ela pertencer ao cliente do token —
-- mesmo padrão de validação de aprovacao_missoes(). Não filtra por status:
-- quem já tem o id da missão (que só vem de aprovacao_missoes(), já filtrado)
-- pode ver os anexos dela em qualquer status.
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

grant execute on function aprovacao_anexos(uuid, uuid) to anon;

-- O download em si (gerar o link assinado do Storage) é feito pela rota
-- /api/aprovacao/anexo do app, não daqui do banco: a API do Storage do
-- Supabase não tem uma função SQL pra assinar URL, então essa etapa usa a
-- service_role key só naquele um arquivo do servidor, e só depois de chamar
-- esta função pra confirmar que o anexo pertence ao cliente do token. Ver
-- src/app/api/aprovacao/anexo/route.ts e CLAUDE.md.
