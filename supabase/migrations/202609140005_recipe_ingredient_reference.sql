alter table public.fichas_tecnicas
  add column if not exists ingrediente_id uuid references public.insumos(id) on delete set null;

update public.fichas_tecnicas as ficha
set ingrediente_id = insumo.id
from public.insumos as insumo
where ficha.ingrediente_id is null
  and lower(trim(ficha.ingrediente_nome)) = lower(trim(insumo.nome));

create index if not exists fichas_tecnicas_ingrediente_id_idx
on public.fichas_tecnicas (ingrediente_id);
