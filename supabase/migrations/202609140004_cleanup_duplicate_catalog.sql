with duplicate_insumos as (
  select
    id,
    row_number() over (
      partition by lower(trim(nome)), categoria
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_number
  from public.insumos
)
delete from public.insumos
where id in (select id from duplicate_insumos where duplicate_number > 1);

with duplicate_recipe_lines as (
  select
    id,
    row_number() over (
      partition by pizza_nome, ingrediente_nome, quantidade, tipo, ordem
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_number
  from public.fichas_tecnicas
)
delete from public.fichas_tecnicas
where id in (select id from duplicate_recipe_lines where duplicate_number > 1);

create unique index if not exists insumos_unique_name_category
on public.insumos (lower(trim(nome)), categoria);

create unique index if not exists insumos_unique_exact_name_category
on public.insumos (nome, categoria);
