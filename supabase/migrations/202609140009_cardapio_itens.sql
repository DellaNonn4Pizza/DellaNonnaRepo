create extension if not exists pgcrypto;

create table if not exists public.cardapio_itens (
  id uuid primary key default gen_random_uuid(),
  nome_comercial text not null,
  ficha_tecnica_ref text not null references public.precificacao(pizza_nome) on update cascade on delete restrict,
  descricao text,
  categoria text not null default 'Pizza' check (categoria in ('Pizza', 'Esfiha', 'Bebida', 'Outro')),
  tamanho text,
  imagem_url text,
  preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0),
  disponivel boolean not null default true,
  destaque boolean not null default false,
  ordem_exibicao integer not null default 1 check (ordem_exibicao >= 1),
  observacoes_internas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cardapio_itens_touch_updated_at on public.cardapio_itens;
create trigger cardapio_itens_touch_updated_at before update on public.cardapio_itens for each row execute function public.touch_updated_at();

alter table public.cardapio_itens enable row level security;

drop policy if exists "authenticated users can manage menu items" on public.cardapio_itens;
create policy "authenticated users can manage menu items" on public.cardapio_itens for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('cardapio', 'cardapio', true)
on conflict (id) do nothing;

drop policy if exists "public cardapio images are viewable" on storage.objects;
create policy "public cardapio images are viewable" on storage.objects
for select using (bucket_id = 'cardapio');

drop policy if exists "authenticated users can upload cardapio images" on storage.objects;
create policy "authenticated users can upload cardapio images" on storage.objects
for insert with check (
  bucket_id = 'cardapio' and auth.role() = 'authenticated'
);

drop policy if exists "authenticated users can update cardapio images" on storage.objects;
create policy "authenticated users can update cardapio images" on storage.objects
for update using (bucket_id = 'cardapio' and auth.role() = 'authenticated')
with check (bucket_id = 'cardapio' and auth.role() = 'authenticated');

drop policy if exists "authenticated users can delete cardapio images" on storage.objects;
create policy "authenticated users can delete cardapio images" on storage.objects
for delete using (bucket_id = 'cardapio' and auth.role() = 'authenticated');
