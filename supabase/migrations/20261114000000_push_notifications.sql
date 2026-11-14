-- Push notifications (Web Push) to phones and computers: each device's subscription, each user's
-- notification settings, a log so nothing is sent twice, and a job that runs the
-- `push-reminders` Edge Function every 5 minutes.

-- One row per device that turned notifications on: where the browser's push service takes them.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Read your own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Remove your own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Saves this device's subscription for the signed-in user. A device has one endpoint; if someone
-- else signed in on it before, it moves to whoever turns notifications on now.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to turn on notifications';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, p_user_agent);
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Which notifications each user wants and when (see supabase/functions/_shared/reminders.ts for
-- the shape and defaults), and the time zone their times are in.
create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  time_zone text not null default 'America/Los_Angeles',
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy "Read your own notification settings"
  on public.notification_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Add your own notification settings"
  on public.notification_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Remove your own notification settings"
  on public.notification_settings for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Change your own notification settings"
  on public.notification_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Every notification sent, by kind and what it's about, so each goes out once. Only the Edge
-- Function (with the service role) reads or writes it.
create table public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

alter table public.notification_log enable row level security;

-- Every 5 minutes, ask the push-reminders Edge Function to send what's due. It needs the project's
-- address, saved once in the Vault as `project_url` (see "Push notifications" in the README);
-- until then this does nothing.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.run_push_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'project_url';
  if v_url is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/push-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "run"}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.run_push_reminders() from public, anon, authenticated;

select cron.schedule('push-reminders', '*/5 * * * *', 'select public.run_push_reminders()');
