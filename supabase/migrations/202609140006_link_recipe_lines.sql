alter table public.fichas_tecnicas
  add column if not exists pizza_id uuid references public.precificacao(id) on delete cascade;

update public.fichas_tecnicas as ficha
set pizza_id = pricing.id
from public.precificacao as pricing
where ficha.pizza_id is null
  and ficha.pizza_nome = pricing.pizza_nome;

create index if not exists fichas_tecnicas_pizza_id_idx
on public.fichas_tecnicas (pizza_id);
