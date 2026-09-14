# Supabase

## Configurar o frontend

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel do projeto Supabase.
3. Crie o único administrador em **Authentication > Users > Add user**. O app não expõe cadastro público.

## Aplicar a migration

Com o Supabase CLI instalado e autenticado:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

A migration cria as tabelas, constraints, coluna calculada de preço unitário, triggers de atualização, RLS para usuários autenticados e os registros iniciais de conversão e gás.

O app usa somente a chave `anon` no navegador. Não coloque a `service_role` em `.env.local` nem no bundle frontend.
