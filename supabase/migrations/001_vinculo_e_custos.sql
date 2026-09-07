-- ---------------------------------------------------------------------------
-- Fase 0 (vínculo + quem executa sem ter acesso) e Fase 1 (custo por entrega).
--
-- Rode este arquivo UMA VEZ no SQL Editor do Supabase, em um banco que já tem
-- o `schema.sql` original aplicado. Quem estiver criando o banco do zero não
-- precisa dele: o `schema.sql` já vem com tudo isto embutido.
--
-- O que muda e por quê:
--
-- 1. `email` deixa de ser obrigatório. A tabela `usuarios` passa a responder
--    duas perguntas diferentes: "quem executa missões" (todo mundo) e "quem
--    entra no sistema" (só quem tem e-mail). Uma linha sem e-mail nunca casa
--    com `auth.jwt() ->> 'email'`, então `nome_do_usuario_logado()` devolve
--    null pra ela e a RLS a barra sozinha — é assim que a produtora de vídeo
--    terceirizada aparece no campo "quem" das missões sem ganhar login.
--    (O índice único de e-mail continua: o Postgres permite vários NULLs.)
--
-- 2. `vinculo` diz COMO o custo daquela pessoa se calcula — cada forma é uma
--    conta diferente, não um detalhe cadastral:
--      dono/socio  → o custo é o pró-labore (pode ser zero); o que pesa de
--                    verdade é o tempo, que não tem nota fiscal
--      por_projeto → custo variável, valor combinado por entrega (Fase 2)
--      fornecedor  → pacote fechado no período, independente do volume
--      clt         → salário mensal (ninguém hoje; existe pra quando contratar)
--    Fica NULO de propósito para quem ainda não foi classificado: o resto do
--    sistema prefere "não computável" a um número inventado (ver os retornos
--    `disponivel: false` em src/lib/performance-metrics.ts).
--
-- 3. `custo_mensal` + `horas_mensais` são a entrada da Fase 1. Para um
--    `fornecedor`, `custo_mensal` é o valor do pacote — e o custo por entrega
--    é ele dividido pelas missões que a pessoa concluiu no mês.
-- ---------------------------------------------------------------------------

alter table usuarios alter column email drop not null;

alter table usuarios
  add column vinculo text
    check (vinculo in ('dono', 'socio', 'por_projeto', 'fornecedor', 'clt')),
  add column custo_mensal numeric check (custo_mensal >= 0),
  add column horas_mensais numeric check (horas_mensais > 0);

comment on column usuarios.email is
  'Nulo = executa missões mas não entra no sistema (ex.: fornecedor terceirizado).';
comment on column usuarios.vinculo is
  'Como o custo desta pessoa se calcula. Nulo = ainda não classificada.';
comment on column usuarios.custo_mensal is
  'R$/mês. Pacote fechado (fornecedor), salário (clt) ou pró-labore (dono/socio). Não se aplica a por_projeto.';
comment on column usuarios.horas_mensais is
  'Horas disponíveis no mês — base do custo/hora.';

-- Admin não pode se trancar do lado de fora: quem administra precisa de login.
alter table usuarios
  add constraint usuarios_admin_precisa_de_email
  check (papel <> 'admin' or email is not null);
