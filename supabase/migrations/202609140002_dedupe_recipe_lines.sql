with duplicated_lines as (
  select
    id,
    row_number() over (
      partition by pizza_nome, ingrediente_nome, quantidade, tipo, ordem
      order by created_at, id
    ) as duplicate_number
  from public.fichas_tecnicas
)
delete from public.fichas_tecnicas
where id in (select id from duplicated_lines where duplicate_number > 1);

create unique index if not exists fichas_tecnicas_unique_line
on public.fichas_tecnicas (pizza_nome, ingrediente_nome, quantidade, tipo, ordem);
