-- Supabase schema for the static GitHub Pages demo.
-- These policies are intentionally open for a hackathon demo using a browser
-- publishable/anon key. Do not use this policy model for production data.

create extension if not exists pgcrypto;

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_id text not null unique,
  "desc" text,
  unit text,
  service_category_name text not null,
  service_problem_name text not null,
  service_code_name text not null,
  location_address text not null,
  inspection boolean not null default false,
  uploads jsonb not null default '[]'::jsonb,
  guideline jsonb,
  status text not null default 'DISPATCHED',
  created_at timestamptz not null default now(),
  inserted_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.work_order_messages (
  id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.work_orders(work_order_id) on delete cascade,
  created_at timestamptz not null default now(),
  sender text not null,
  recipient text not null,
  message text not null
);

create index if not exists work_orders_inserted_at_idx
  on public.work_orders (inserted_at desc);

create index if not exists work_order_messages_work_order_id_created_at_idx
  on public.work_order_messages (work_order_id, created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_orders_updated_at on public.work_orders;
create trigger set_work_orders_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

alter table public.work_orders enable row level security;
alter table public.work_order_messages enable row level security;

grant usage on schema public to anon;
grant select, insert, update on public.work_orders to anon;
grant select, insert on public.work_order_messages to anon;

drop policy if exists "demo read work orders" on public.work_orders;
create policy "demo read work orders"
on public.work_orders for select
to anon
using (true);

drop policy if exists "demo create work orders" on public.work_orders;
create policy "demo create work orders"
on public.work_orders for insert
to anon
with check (true);

drop policy if exists "demo update work orders" on public.work_orders;
create policy "demo update work orders"
on public.work_orders for update
to anon
using (true)
with check (true);

drop policy if exists "demo read work order messages" on public.work_order_messages;
create policy "demo read work order messages"
on public.work_order_messages for select
to anon
using (true);

drop policy if exists "demo create work order messages" on public.work_order_messages;
create policy "demo create work order messages"
on public.work_order_messages for insert
to anon
with check (
  exists (
    select 1
    from public.work_orders
    where work_orders.work_order_id = work_order_messages.work_order_id
  )
);

-- Storage: work-order photos are uploaded from the browser to the public
-- "hackathon" bucket so the violation + guideline agents can reference a stable
-- public link. Intentionally open for the hackathon demo using the anon key.
insert into storage.buckets (id, name, public)
values ('hackathon', 'hackathon', true)
on conflict (id) do update set public = true;

drop policy if exists "demo read hackathon objects" on storage.objects;
create policy "demo read hackathon objects"
on storage.objects for select
to anon
using (bucket_id = 'hackathon');

drop policy if exists "demo upload hackathon objects" on storage.objects;
create policy "demo upload hackathon objects"
on storage.objects for insert
to anon
with check (bucket_id = 'hackathon');

drop policy if exists "demo update hackathon objects" on storage.objects;
create policy "demo update hackathon objects"
on storage.objects for update
to anon
using (bucket_id = 'hackathon')
with check (bucket_id = 'hackathon');
