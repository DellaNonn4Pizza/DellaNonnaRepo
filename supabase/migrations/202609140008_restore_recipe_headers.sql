insert into public.precificacao (pizza_nome, categoria, tamanho_massa, rendimento_massa, preco_venda)
select distinct ficha.pizza_nome, 'pizza', 'grande', 5, 0
from public.fichas_tecnicas as ficha
where not exists (
  select 1
  from public.precificacao as pricing
  where pricing.pizza_nome = ficha.pizza_nome
);

update public.fichas_tecnicas as ficha
set pizza_id = pricing.id
from public.precificacao as pricing
where ficha.pizza_id is null
  and ficha.pizza_nome = pricing.pizza_nome;
