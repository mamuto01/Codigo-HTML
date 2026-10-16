-- Execute este SQL no SQL Editor do seu projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.secret_draws (
  id integer primary key default 1 check (id = 1),
  organizer_key_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.secret_participants (
  id uuid primary key default gen_random_uuid(),
  draw_id integer not null default 1 references public.secret_draws(id) on delete cascade,
  name text not null,
  name_normalized text not null unique,
  pin_hash text not null,
  assigned_name text not null,
  created_at timestamptz not null default now()
);

alter table public.secret_draws enable row level security;
alter table public.secret_participants enable row level security;

-- Sem políticas públicas: o navegador não pode ler nem alterar tabelas diretamente.
revoke all on public.secret_draws from anon, authenticated;
revoke all on public.secret_participants from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- A Edge Function usa a service role e faz a validação no servidor.
