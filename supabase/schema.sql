create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_likes (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  client_id text not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, client_id)
);

create table if not exists public.idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  content text not null,
  client_id text not null,
  created_at timestamptz not null default now()
);

alter table public.ideas enable row level security;
alter table public.idea_likes enable row level security;
alter table public.idea_comments enable row level security;

create policy "Anyone can read ideas"
  on public.ideas for select
  using (true);

create policy "Anyone can create ideas"
  on public.ideas for insert
  with check (true);

create policy "Anyone can update ideas"
  on public.ideas for update
  using (true)
  with check (true);

create policy "Anyone can delete ideas"
  on public.ideas for delete
  using (true);

create policy "Anyone can read idea likes"
  on public.idea_likes for select
  using (true);

create policy "Anyone can create idea likes"
  on public.idea_likes for insert
  with check (true);

create policy "Anyone can delete idea likes"
  on public.idea_likes for delete
  using (true);

create policy "Anyone can read idea comments"
  on public.idea_comments for select
  using (true);

create policy "Anyone can create idea comments"
  on public.idea_comments for insert
  with check (true);

create policy "Anyone can delete idea comments"
  on public.idea_comments for delete
  using (true);
