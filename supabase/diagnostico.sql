-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO — cole no SQL Editor do Supabase e rode. Não altera nada.
--
-- Responde "o que já está aplicado neste banco e o que falta rodar", porque o
-- painel do Supabase não mostra isso: o "No migrations" de lá se refere ao CLI
-- deles, que este projeto não usa (o SQL é colado à mão).
-- ---------------------------------------------------------------------------

with estado as (
  select
    to_regclass('public.usuarios') is not null as tem_schema,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'usuarios' and column_name = 'vinculo'
    ) as tem_001,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tarefas' and column_name = 'custo_execucao'
    ) as tem_002
)
select
  tem_schema as "schema base criado",
  tem_001 as "fase 0 e 1 aplicadas",
  tem_002 as "fase 2 aplicada",
  case
    when not tem_schema
      then 'Banco vazio. Rode supabase/schema.sql INTEIRO (ele já inclui as fases 0, 1 e 2) — antes, troque o e-mail do SEED no final do arquivo pelo seu.'
    when not tem_001 and not tem_002
      then 'Rode 001_vinculo_e_custos.sql e depois 002_custo_por_missao.sql.'
    when not tem_001
      then 'Falta a 001_vinculo_e_custos.sql (rode antes da 002).'
    when not tem_002
      then 'Falta só a 002_custo_por_missao.sql.'
    else 'Tudo aplicado. Nada a fazer no banco.'
  end as "o que fazer";
