begin;

-- The insert belongs to the same transaction as checkout. No HTTP-side enqueue
-- can lose a committed order or send mail for a rolled-back reservation.
create table if not exists public.order_email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  recipient_email text not null,
  recipient_name text not null,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.order_email_outbox enable row level security;
revoke all on public.order_email_outbox from public, anon, authenticated;
grant select on public.order_email_outbox to service_role;
create index if not exists order_email_outbox_pending_idx
  on public.order_email_outbox(next_attempt_at) where completed_at is null;

create or replace function public.enqueue_order_confirmation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.order_email_outbox(order_id, recipient_email, recipient_name)
    select new.id, u.email, u.name from public.users u where u.id = new.user_id
    on conflict (order_id) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_order_confirmation() from public, anon, authenticated, service_role;
drop trigger if exists orders_confirmation_outbox on public.orders;
create trigger orders_confirmation_outbox after insert on public.orders
  for each row execute function public.enqueue_order_confirmation();

create or replace function public.claim_order_emails(p_limit integer default 10)
returns setof public.order_email_outbox
language sql security definer set search_path = '' as $$
  with due as (
    select id from public.order_email_outbox
    where completed_at is null and next_attempt_at <= now()
      and (leased_until is null or leased_until <= now())
    order by next_attempt_at, id for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  )
  update public.order_email_outbox q
    set lease_token = gen_random_uuid(), leased_until = now() + interval '2 minutes',
        attempts = attempts + 1
    from due where q.id = due.id returning q.*;
$$;

-- Renewal is conditional on current, unexpired ownership. A worker cannot
-- revive a lease after another worker may have reclaimed its job.
create or replace function public.renew_order_email_lease(p_id uuid, p_lease_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.order_email_outbox set leased_until = now() + interval '2 minutes'
    where id = p_id and lease_token = p_lease_token and completed_at is null
      and leased_until > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.finish_order_email(
  p_id uuid, p_lease_token uuid, p_success boolean, p_error text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.order_email_outbox
    set completed_at = case when p_success then now() else null end,
        next_attempt_at = case when p_success then next_attempt_at
          else now() + make_interval(secs => least(3600, 30 * power(2, least(attempts, 7)))::double precision) end,
        last_error = case when p_success then null else left(coalesce(p_error, 'DELIVERY_FAILED'), 80) end,
        lease_token = null, leased_until = null
    where id = p_id and lease_token = p_lease_token and completed_at is null;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.claim_order_emails(integer) from public, anon, authenticated;
revoke all on function public.renew_order_email_lease(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_order_email(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_order_emails(integer) to service_role;
grant execute on function public.renew_order_email_lease(uuid, uuid) to service_role;
grant execute on function public.finish_order_email(uuid, uuid, boolean, text) to service_role;
notify pgrst, 'reload schema';
commit;
