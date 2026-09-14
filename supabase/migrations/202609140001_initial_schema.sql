create extension if not exists pgcrypto;

create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  marca_obs text,
  qtd_embalagem numeric(12,3) not null check (qtd_embalagem > 0),
  unidade text not null check (unidade in ('g', 'ml', 'unid')),
  preco_pago numeric(12,2) not null default 0 check (preco_pago >= 0),
  categoria text not null default 'insumo' check (categoria in ('insumo', 'embalagem')),
  preco_unitario numeric(14,6) generated always as (preco_pago / nullif(qtd_embalagem, 0)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premissas_conversao (
  id uuid primary key default gen_random_uuid(),
  item text not null unique,
  peso_medio_g numeric(12,3) not null check (peso_medio_g > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  pizza_nome text not null,
  ingrediente_nome text not null,
  quantidade numeric(12,3) not null default 0 check (quantidade >= 0),
  tipo text not null check (tipo in ('g', 'ml', 'unidade_cebola', 'unidade_azeitona')),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receita_massa (
  id uuid primary key default gen_random_uuid(),
  ingrediente_nome text not null unique,
  quantidade_g numeric(12,3) not null default 0 check (quantidade_g >= 0),
  rendimento_pizzas numeric(12,3) not null default 5 check (rendimento_pizzas > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.precificacao (
  id uuid primary key default gen_random_uuid(),
  pizza_nome text not null unique,
  preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0),
  concorrente_massa_arretada numeric(12,2) check (concorrente_massa_arretada >= 0),
  concorrente_dantas numeric(12,2) check (concorrente_dantas >= 0),
  concorrente_farini numeric(12,2) check (concorrente_farini >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.gas (
  id boolean primary key default true check (id),
  preco_botijao numeric(12,2) not null default 0 check (preco_botijao >= 0),
  peso_botijao_kg numeric(12,3) not null default 13 check (peso_botijao_kg > 0),
  consumo_kg_hora numeric(12,3) not null default 0 check (consumo_kg_hora >= 0),
  tempo_turno_min numeric(12,3) not null default 0 check (tempo_turno_min >= 0),
  pizzas_por_turno numeric(12,3) not null default 1 check (pizzas_por_turno > 0),
  incluir_no_custo boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists insumos_touch_updated_at on public.insumos;
create trigger insumos_touch_updated_at before update on public.insumos for each row execute function public.touch_updated_at();
drop trigger if exists premissas_touch_updated_at on public.premissas_conversao;
create trigger premissas_touch_updated_at before update on public.premissas_conversao for each row execute function public.touch_updated_at();
drop trigger if exists fichas_touch_updated_at on public.fichas_tecnicas;
create trigger fichas_touch_updated_at before update on public.fichas_tecnicas for each row execute function public.touch_updated_at();
drop trigger if exists massa_touch_updated_at on public.receita_massa;
create trigger massa_touch_updated_at before update on public.receita_massa for each row execute function public.touch_updated_at();
drop trigger if exists precificacao_touch_updated_at on public.precificacao;
create trigger precificacao_touch_updated_at before update on public.precificacao for each row execute function public.touch_updated_at();
drop trigger if exists gas_touch_updated_at on public.gas;
create trigger gas_touch_updated_at before update on public.gas for each row execute function public.touch_updated_at();

alter table public.insumos enable row level security;
alter table public.premissas_conversao enable row level security;
alter table public.fichas_tecnicas enable row level security;
alter table public.receita_massa enable row level security;
alter table public.precificacao enable row level security;
alter table public.gas enable row level security;

drop policy if exists "authenticated users can manage insumos" on public.insumos;
create policy "authenticated users can manage insumos" on public.insumos for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users can manage conversion assumptions" on public.premissas_conversao;
create policy "authenticated users can manage conversion assumptions" on public.premissas_conversao for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users can manage technical sheets" on public.fichas_tecnicas;
create policy "authenticated users can manage technical sheets" on public.fichas_tecnicas for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users can manage dough recipes" on public.receita_massa;
create policy "authenticated users can manage dough recipes" on public.receita_massa for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users can manage pricing" on public.precificacao;
create policy "authenticated users can manage pricing" on public.precificacao for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users can manage gas" on public.gas;
create policy "authenticated users can manage gas" on public.gas for all to authenticated using (true) with check (true);

insert into public.premissas_conversao (item, peso_medio_g) values
  ('Cebola (1 unidade)', 130), ('Azeitona (1 unidade)', 4)
on conflict (item) do nothing;

insert into public.gas (id, preco_botijao, peso_botijao_kg, consumo_kg_hora, tempo_turno_min, pizzas_por_turno)
values (true, 115, 13, 0.7, 180, 60)
on conflict (id) do nothing;

insert into public.insumos (nome, marca_obs, qtd_embalagem, unidade, preco_pago, categoria)
select seed.nome, seed.marca_obs, seed.qtd_embalagem, seed.unidade, seed.preco_pago, seed.categoria
from (values
  ('Farinha de trigo', 'Rosa Branca', 5000, 'g', 22.90, 'insumo'),
  ('Muçarela', 'Laticínios Della', 5000, 'g', 129.50, 'insumo'),
  ('Calabresa', 'Sadia', 2400, 'g', 69.90, 'insumo'),
  ('Frango desfiado', 'Produção própria', 1000, 'g', 23.50, 'insumo'),
  ('Requeijão', 'Catupiry', 2500, 'g', 89.90, 'insumo'),
  ('Molho de tomate', 'La Pastina', 2000, 'g', 18.90, 'insumo'),
  ('Cebola', 'Hortifruti', 1000, 'g', 7.90, 'insumo'),
  ('Azeitona', 'Vale Fértil', 500, 'g', 14.90, 'insumo'),
  ('Caixa 35cm', 'Embalagens Brasil', 100, 'unid', 149.00, 'embalagem')
) as seed(nome, marca_obs, qtd_embalagem, unidade, preco_pago, categoria)
where not exists (select 1 from public.insumos existing where existing.nome = seed.nome and existing.categoria = seed.categoria);

insert into public.receita_massa (ingrediente_nome, quantidade_g, rendimento_pizzas)
values ('Farinha de trigo', 1000, 5), ('Água', 600, 5), ('Fermento', 20, 5), ('Sal', 25, 5), ('Óleo', 30, 5)
on conflict (ingrediente_nome) do nothing;

insert into public.precificacao (pizza_nome, preco_venda, concorrente_massa_arretada, concorrente_dantas, concorrente_farini)
values
  ('Calabresa', 49.90, 55, 52, null),
  ('Mussarela', 47.90, 52, 49.90, 51),
  ('Frango com Requeijão', 54.90, 59, 57, 56),
  ('Frango sem Requeijão', 49.90, 55, 53, null),
  ('Calabresa com Requeijão', 56.90, 62, 59, 58)
on conflict (pizza_nome) do nothing;

insert into public.fichas_tecnicas (pizza_nome, ingrediente_nome, quantidade, tipo, ordem)
values
  ('Calabresa', 'Molho de tomate', 100, 'g', 1), ('Calabresa', 'Muçarela', 220, 'g', 2), ('Calabresa', 'Calabresa', 180, 'g', 3), ('Calabresa', 'Cebola', 0.5, 'unidade_cebola', 4), ('Calabresa', 'Azeitona', 8, 'unidade_azeitona', 5),
  ('Mussarela', 'Molho de tomate', 100, 'g', 1), ('Mussarela', 'Muçarela', 280, 'g', 2), ('Mussarela', 'Azeitona', 8, 'unidade_azeitona', 3),
  ('Frango com Requeijão', 'Molho de tomate', 100, 'g', 1), ('Frango com Requeijão', 'Muçarela', 180, 'g', 2), ('Frango com Requeijão', 'Frango desfiado', 200, 'g', 3), ('Frango com Requeijão', 'Requeijão', 100, 'g', 4),
  ('Frango sem Requeijão', 'Molho de tomate', 100, 'g', 1), ('Frango sem Requeijão', 'Muçarela', 200, 'g', 2), ('Frango sem Requeijão', 'Frango desfiado', 200, 'g', 3),
  ('Calabresa com Requeijão', 'Molho de tomate', 100, 'g', 1), ('Calabresa com Requeijão', 'Muçarela', 180, 'g', 2), ('Calabresa com Requeijão', 'Calabresa', 150, 'g', 3), ('Calabresa com Requeijão', 'Requeijão', 90, 'g', 4);

-- Create the first admin through Supabase Auth, then use that account to access these tables.
-- No public sign-up route is exposed by the application.
