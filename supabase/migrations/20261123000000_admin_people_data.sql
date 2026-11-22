-- More for admins on the Admin page: remove someone from Rocket, and export or import their data
-- (the same file as Settings → Your data). Each checks the caller is an admin and is logged.

-- Removes someone and everything they made (workouts, backblasts, templates, likes, archive),
-- by deleting their account. Not yourself, and not another admin (remove them as admin first).
create or replace function public.admin_remove_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
  mail text;
begin
  perform public.admin_only();
  if p_user = auth.uid() then
    raise exception 'You can''t remove yourself.';
  end if;
  if exists (select 1 from public.admins where user_id = p_user) then
    raise exception 'They''re an admin: remove them as admin first.';
  end if;
  select p.name, u.email into who, mail
    from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
  if not found then
    raise exception 'No such person.';
  end if;
  delete from auth.users where id = p_user;
  perform public.admin_note('user_removed', coalesce(who, mail), jsonb_build_object('email', mail));
end;
$$;

revoke execute on function public.admin_remove_user(uuid) from public, anon;
grant execute on function public.admin_remove_user(uuid) to authenticated;

-- The account settings an export carries (as lib/account-data.ts's ACCOUNT_KEYS).
create or replace function public.account_setting_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'name', 'f3_name', 'name_on_roster', 'language', 'swipe_left', 'home_sections',
    'home_sections_seen', 'region_id', 'public_sources', 'discover_include_own',
    'discover_own_asked', 'share_workout_link', 'pax_sources_off', 'pax_rocket_only',
    'default_workout_visibility', 'default_backblast_visibility', 'notices_off'
  ];
$$;

-- Someone's data as an export file (the same shape Settings → Your data makes; no device settings).
create or replace function public.admin_export_user(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb;
  mail text;
  result jsonb;
begin
  perform public.admin_only();
  select coalesce(raw_user_meta_data, '{}'::jsonb), email into meta, mail
    from auth.users where id = p_user;
  if not found then
    raise exception 'No such person.';
  end if;
  result := jsonb_build_object(
    'app', 'rocket',
    'format', 1,
    'version', 'admin export',
    'exportedAt', now(),
    'account', jsonb_build_object(
      'id', p_user, 'email', mail,
      'name', coalesce(meta ->> 'f3_name', meta ->> 'name', '')),
    'settings', jsonb_build_object(
      'account', coalesce((
        select jsonb_object_agg(k, meta -> k)
        from unnest(public.account_setting_keys()) k where meta ? k), '{}'::jsonb),
      'device', '{}'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(
        to_jsonb(w) || case when coalesce(n.body, '') <> ''
          then jsonb_build_object('notes', n.body) else '{}'::jsonb end
        order by w.created_at)
      from public.workouts w
      left join public.workout_notes n on n.workout_id = w.id
      where w.author_id = p_user), '[]'::jsonb),
    'backblasts', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.created_at)
      from public.backblasts b where b.author_id = p_user), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.name)
      from public.section_templates t where t.owner_id = p_user), '[]'::jsonb),
    'archives', jsonb_build_object(
      'workouts', coalesce((select jsonb_agg(workout_id) from public.workout_archives
        where user_id = p_user), '[]'::jsonb),
      'backblasts', coalesce((select jsonb_agg(backblast_id) from public.backblast_archives
        where user_id = p_user), '[]'::jsonb)),
    'likes', coalesce((select jsonb_agg(workout_id) from public.workout_likes
      where user_id = p_user), '[]'::jsonb)
  );
  perform public.admin_note('data_exported',
    (select name from public.profiles where id = p_user), jsonb_build_object('user', p_user));
  return result;
end;
$$;

revoke execute on function public.admin_export_user(uuid) from public, anon;
grant execute on function public.admin_export_user(uuid) to authenticated;

-- Inserts a row from JSON into a table, using only the columns both have (the rest get their
-- defaults, so an export from before a column was added still goes in).
create or replace function public.admin_insert_row(p_table text, p_row jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ')
    into cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = p_table and p_row ? c.column_name;
  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)',
    p_table, cols)
    using p_row;
end;
$$;

revoke execute on function public.admin_insert_row(text, jsonb) from public, anon, authenticated;

-- Brings an export file into someone's account: what isn't there is added (keeping IDs when
-- they're free, else new ones, with links between them followed); what's already theirs is kept
-- as it is. With p_settings, their settings, name and region come from the file too. Returns how
-- many were added and kept, and what failed.
create or replace function public.admin_import_user(p_user uuid, p_data jsonb, p_settings boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  row_data jsonb;
  old_id text;
  new_id uuid;
  workout_ids jsonb := '{}'::jsonb;
  backblast_ids jsonb := '{}'::jsonb;
  added int := 0;
  kept int := 0;
  failed jsonb := '[]'::jsonb;
  account jsonb;
  f3 text;
  region text;
  scope text;
begin
  perform public.admin_only();
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'No such person.';
  end if;
  if p_data ->> 'app' is distinct from 'rocket' then
    raise exception 'That file isn''t a Rocket export.';
  end if;

  -- Workouts, oldest first, so a reuse's source is already here.
  for item in
    select value from jsonb_array_elements(coalesce(p_data -> 'workouts', '[]'::jsonb))
    order by value ->> 'created_at'
  loop
    old_id := item ->> 'id';
    begin
      if exists (select 1 from public.workouts where id = old_id::uuid and author_id = p_user) then
        kept := kept + 1;
        workout_ids := workout_ids || jsonb_build_object(old_id, old_id);
        continue;
      end if;
      new_id := case when exists (select 1 from public.workouts where id = old_id::uuid)
        then gen_random_uuid() else old_id::uuid end;
      row_data := (item - 'notes') || jsonb_build_object(
        'id', new_id, 'author_id', p_user,
        'reused_from', coalesce(workout_ids ->> (item ->> 'reused_from'), item ->> 'reused_from'));
      begin
        perform public.admin_insert_row('workouts', row_data);
      exception when foreign_key_violation then
        perform public.admin_insert_row('workouts',
          row_data || '{"reused_from": null, "original_author_id": null}'::jsonb);
      end;
      workout_ids := workout_ids || jsonb_build_object(old_id, new_id::text);
      if coalesce(item ->> 'notes', '') <> '' then
        insert into public.workout_notes (workout_id, author_id, body)
          values (new_id, p_user, item ->> 'notes')
          on conflict (workout_id) do update set body = excluded.body;
      end if;
      -- A workout deleted and now back (same ID) gets back the likes and reuses set aside for it.
      if new_id = old_id::uuid then
        insert into public.workout_likes (user_id, workout_id, created_at)
          select r.user_id, new_id, r.liked_at from public.retired_workout_likes r
          join public.profiles p on p.id = r.user_id
          where r.workout_id = new_id and r.author_id = p_user and r.user_id <> p_user
          on conflict do nothing;
        update public.workouts w set reused_from = new_id
          from public.retired_workout_reuses r
          where r.workout_id = new_id and r.author_id = p_user
            and w.id = r.reuse_id and w.reused_from is null;
        delete from public.retired_workout_likes where workout_id = new_id and author_id = p_user;
        delete from public.retired_workout_reuses where workout_id = new_id and author_id = p_user;
      end if;
      added := added + 1;
    exception when others then
      failed := failed || to_jsonb(format('Workout “%s”: %s', item ->> 'title', sqlerrm));
    end;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_data -> 'backblasts', '[]'::jsonb))
  loop
    old_id := item ->> 'id';
    begin
      if exists (select 1 from public.backblasts where id = old_id::uuid and author_id = p_user) then
        kept := kept + 1;
        backblast_ids := backblast_ids || jsonb_build_object(old_id, old_id);
        continue;
      end if;
      new_id := case when exists (select 1 from public.backblasts where id = old_id::uuid)
        then gen_random_uuid() else old_id::uuid end;
      row_data := item || jsonb_build_object(
        'id', new_id, 'author_id', p_user,
        'workout_id', coalesce(workout_ids ->> (item ->> 'workout_id'), item ->> 'workout_id'));
      begin
        perform public.admin_insert_row('backblasts', row_data);
      exception when foreign_key_violation then
        perform public.admin_insert_row('backblasts', row_data || '{"workout_id": null}'::jsonb);
      end;
      backblast_ids := backblast_ids || jsonb_build_object(old_id, new_id::text);
      added := added + 1;
    exception when others then
      failed := failed || to_jsonb(format('Backblast “%s”: %s', item ->> 'title', sqlerrm));
    end;
  end loop;

  -- Templates match by section and name; one default per section.
  for item in
    select value from jsonb_array_elements(coalesce(p_data -> 'templates', '[]'::jsonb))
  loop
    begin
      if exists (select 1 from public.section_templates
          where owner_id = p_user and section = item ->> 'section' and name = item ->> 'name') then
        kept := kept + 1;
        continue;
      end if;
      insert into public.section_templates (owner_id, section, name, body, is_default)
        values (p_user, item ->> 'section', item ->> 'name', coalesce(item ->> 'body', ''),
          coalesce((item ->> 'is_default')::boolean, false)
            and not exists (select 1 from public.section_templates
              where owner_id = p_user and section = item ->> 'section' and is_default));
      added := added + 1;
    exception when others then
      failed := failed || to_jsonb(format('Template “%s”: %s', item ->> 'name', sqlerrm));
    end;
  end loop;

  -- Archive and likes, quietly skipping any that no longer apply.
  for old_id in
    select value from jsonb_array_elements_text(coalesce(p_data -> 'archives' -> 'workouts', '[]'))
  loop
    begin
      insert into public.workout_archives (user_id, workout_id)
        values (p_user, coalesce(workout_ids ->> old_id, old_id)::uuid) on conflict do nothing;
    exception when others then null;
    end;
  end loop;
  for old_id in
    select value from jsonb_array_elements_text(coalesce(p_data -> 'archives' -> 'backblasts', '[]'))
  loop
    begin
      insert into public.backblast_archives (user_id, backblast_id)
        values (p_user, coalesce(backblast_ids ->> old_id, old_id)::uuid) on conflict do nothing;
    exception when others then null;
    end;
  end loop;
  for old_id in
    select value from jsonb_array_elements_text(coalesce(p_data -> 'likes', '[]'::jsonb))
  loop
    begin
      insert into public.workout_likes (user_id, workout_id)
        values (p_user, old_id::uuid) on conflict do nothing;
    exception when others then null;
    end;
  end loop;

  -- Settings: the account's (as kept in its sign-in), and its name and region on the profile.
  if p_settings then
    account := coalesce((
      select jsonb_object_agg(key, value)
      from jsonb_each(coalesce(p_data -> 'settings' -> 'account', '{}'::jsonb))
      where key = any (public.account_setting_keys())), '{}'::jsonb);
    -- The F3 name (`name` can be the Google account's real name).
    f3 := nullif(btrim(coalesce(account ->> 'f3_name', account ->> 'name', '')), '');
    region := account ->> 'region_id';
    scope := case when region in ('all:f3', 'all:fia') then substr(region, 5) end;
    if scope is null and region is not null
      and not exists (select 1 from public.regions where id::text = region) then
      region := null;
    end if;
    begin
      update public.profiles set
        name = coalesce(f3, name),
        region_id = case when scope is null and region is not null then region::uuid end,
        region_scope = scope
        where id = p_user;
      update auth.users set raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb) || account
          || jsonb_build_object('region_id', region)
          || case when f3 is not null then jsonb_build_object('f3_name', f3) else '{}'::jsonb end
        where id = p_user;
    exception when others then
      failed := failed || to_jsonb(format('Settings: %s', sqlerrm));
    end;
  end if;

  perform public.admin_note('data_imported', (select name from public.profiles where id = p_user),
    jsonb_build_object('user', p_user, 'added', added, 'kept', kept,
      'failed', jsonb_array_length(failed), 'settings', p_settings));
  return jsonb_build_object('added', added, 'kept', kept, 'failed', failed);
end;
$$;

revoke execute on function public.admin_import_user(uuid, jsonb, boolean) from public, anon;
grant execute on function public.admin_import_user(uuid, jsonb, boolean) to authenticated;
