alter table public.precificacao
  add column if not exists categoria text not null default 'pizza' check (categoria in ('pizza', 'massa')),
  add column if not exists tamanho_massa text not null default 'grande' check (tamanho_massa in ('broto', 'grande')),
  add column if not exists massa_utilizada text,
  add column if not exists rendimento_massa numeric(12,3) not null default 5 check (rendimento_massa > 0);
