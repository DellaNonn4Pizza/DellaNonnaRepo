with duplicate_pricing as (
  select
    id,
    row_number() over (
      partition by pizza_nome
      order by updated_at desc, id desc
    ) as duplicate_number
  from public.precificacao
)
delete from public.precificacao
where id in (select id from duplicate_pricing where duplicate_number > 1);

-- Fichas sem cabeçalho não são apagadas: elas podem ser receitas antigas
-- e são restauradas por 202609140008_restore_recipe_headers.sql.
