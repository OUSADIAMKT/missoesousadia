-- ---------------------------------------------------------------------------
-- Fase 2 — custo direto da missão (quem é pago por entrega, não por mês).
--
-- Rode UMA VEZ no SQL Editor do Supabase, depois da 001. Bancos criados do
-- zero pelo `schema.sql` já vêm com esta coluna.
--
-- É a última peça que faltava para calcular lucro por cliente: a receita já
-- existe (`clientes.valor_mensal`) e o custo fixo mensal veio na 001. Com o
-- custo por missão, todo dinheiro que realmente entra e sai passa a ter onde
-- ser lançado — sem depender de apontamento de horas.
-- ---------------------------------------------------------------------------

alter table tarefas add column custo_execucao numeric check (custo_execucao >= 0);

comment on column tarefas.custo_execucao is
  'R$ combinados com quem executa esta missão. Só faz sentido para responsável de vínculo por_projeto — quem tem custo fixo mensal é rateado, não lançado missão a missão.';
