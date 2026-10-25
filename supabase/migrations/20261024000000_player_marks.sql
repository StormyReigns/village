-- Your own marks in a game's app: checklist ticks ("last-chances.leda-paralogue") and units
-- you've recruited ("recruited:units.goliath"). Kept on the device for everyone, and here
-- too for signed-in players, so they follow you to every device. Only you can see yours.

create table if not exists public.player_marks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  mark       text not null check (char_length(mark) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (profile_id, game_id, mark)
);

alter table public.player_marks enable row level security;

drop policy if exists "read own marks" on public.player_marks;
drop policy if exists "add own marks" on public.player_marks;
drop policy if exists "remove own marks" on public.player_marks;
create policy "read own marks"   on public.player_marks for select using (profile_id = auth.uid());
create policy "add own marks"    on public.player_marks for insert with check (profile_id = auth.uid());
create policy "remove own marks" on public.player_marks for delete using (profile_id = auth.uid());
