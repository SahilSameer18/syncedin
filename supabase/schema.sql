-- TwinLink v1 schema
-- Run this in the Supabase SQL editor on a fresh project.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  is_test_persona boolean not null default false,
  created_at timestamptz not null default now()
);

-- Idempotent: adds the column if you already ran the previous schema.
alter table public.profiles
  add column if not exists is_test_persona boolean not null default false;

create index if not exists profiles_test_persona_idx
  on public.profiles (is_test_persona) where is_test_persona = true;

create table if not exists public.twin_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  goals text,
  deal_preferences text,
  communication_style text,
  deal_breakers text,
  ai_export_blob text,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active', -- 'active' | 'paused' | 'closed'
  created_at timestamptz not null default now(),
  constraint distinct_participants check (participant_a <> participant_b)
);

create index if not exists conversations_participants_idx
  on public.conversations (participant_a, participant_b);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  original_draft text not null,
  final_text text not null,
  edited boolean not null default false,
  sent_at timestamptz not null default now()
);

create index if not exists messages_conv_idx
  on public.messages (conversation_id, sent_at);

create table if not exists public.edit_deltas (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_draft text not null,
  edited_text text not null,
  conversation_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists edit_deltas_user_idx
  on public.edit_deltas (user_id, created_at desc);

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.twin_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.edit_deltas enable row level security;

-- profiles: everyone can SELECT (so you can look up users by email to start a conversation);
-- only the owner can INSERT/UPDATE their own row.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- twin_profiles: only the owner reads/writes their own twin. The server uses the
-- service-role key to read counterpart twins in trusted server contexts.
drop policy if exists "twin_profiles_select_own" on public.twin_profiles;
create policy "twin_profiles_select_own" on public.twin_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "twin_profiles_insert_own" on public.twin_profiles;
create policy "twin_profiles_insert_own" on public.twin_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "twin_profiles_update_own" on public.twin_profiles;
create policy "twin_profiles_update_own" on public.twin_profiles
  for update using (auth.uid() = user_id);

-- conversations: only participants.
drop policy if exists "conv_select_participant" on public.conversations;
create policy "conv_select_participant" on public.conversations
  for select using (auth.uid() = participant_a or auth.uid() = participant_b);

drop policy if exists "conv_insert_participant" on public.conversations;
create policy "conv_insert_participant" on public.conversations
  for insert with check (auth.uid() = participant_a or auth.uid() = participant_b);

-- messages: participants of the conversation only.
drop policy if exists "msg_select_participant" on public.messages;
create policy "msg_select_participant" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

drop policy if exists "msg_insert_sender" on public.messages;
create policy "msg_insert_sender" on public.messages
  for insert with check (auth.uid() = sender_user_id);

-- edit_deltas: each user can only read their own deltas (proprietary training corpus).
drop policy if exists "delta_select_own" on public.edit_deltas;
create policy "delta_select_own" on public.edit_deltas
  for select using (auth.uid() = user_id);

drop policy if exists "delta_insert_own" on public.edit_deltas;
create policy "delta_insert_own" on public.edit_deltas
  for insert with check (auth.uid() = user_id);

-- =========================================================================
-- Auto-create a profile row when a new auth user is created
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Agreement responses — accept (green ✓) / reject (red ✗) on a proposed
-- final destination. A rejection resets all responses and regenerates.
-- =========================================================================

create table if not exists public.agreement_responses (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('accepted', 'rejected')),
  reason text,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists agreement_responses_conv_idx
  on public.agreement_responses (conversation_id);

alter table public.agreement_responses enable row level security;

drop policy if exists "agreement_responses_select_participant" on public.agreement_responses;
create policy "agreement_responses_select_participant" on public.agreement_responses
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = agreement_responses.conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

drop policy if exists "agreement_responses_insert_own" on public.agreement_responses;
create policy "agreement_responses_insert_own" on public.agreement_responses
  for insert with check (auth.uid() = user_id);

drop policy if exists "agreement_responses_update_own" on public.agreement_responses;
create policy "agreement_responses_update_own" on public.agreement_responses
  for update using (auth.uid() = user_id);

drop policy if exists "agreement_responses_delete_participant" on public.agreement_responses;
create policy "agreement_responses_delete_participant" on public.agreement_responses
  for delete using (
    exists (
      select 1 from public.conversations c
      where c.id = agreement_responses.conversation_id
        and (c.participant_a = auth.uid() or c.participant_b = auth.uid())
    )
  );

-- =========================================================================
-- Conversation summaries + excitement score
-- After a conversation completes, the platform generates a one-line outcome
-- summary, a "who they are" summary of the counterpart, and an excitement
-- score (0-100). The user can override the score; an override locks it and
-- is kept as a signal for calibrating future scoring.
-- =========================================================================

alter table public.conversations
  add column if not exists summary text;
alter table public.conversations
  add column if not exists counterpart_summary text;
alter table public.conversations
  add column if not exists excitement_score integer;
alter table public.conversations
  add column if not exists excitement_locked boolean not null default false;

-- Participants can UPDATE their conversations (needed for the excitement override).
drop policy if exists "conv_update_participant" on public.conversations;
create policy "conv_update_participant" on public.conversations
  for update using (
    auth.uid() = participant_a or auth.uid() = participant_b
  );

-- =========================================================================
-- Pending invites — landing pages at syncedin.org/<slug>
-- When a user has their twin draft an outreach to a person Exa found, we
-- generate a public landing-page invite. The recipient hits the URL, sees
-- the conversation starter from the twin, and signs up to reply.
-- =========================================================================

create table if not exists public.pending_invites (
  slug text primary key,
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  person_title text,
  person_url text,
  person_highlights jsonb,
  conversation_starter text not null,
  claimed_by_user_id uuid references public.profiles(id) on delete set null,
  claimed_conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pending_invites_inviter_idx
  on public.pending_invites (inviter_user_id);

alter table public.pending_invites enable row level security;

-- Anyone can read by slug — these are public landing pages.
drop policy if exists "pending_invites_public_read" on public.pending_invites;
create policy "pending_invites_public_read" on public.pending_invites
  for select using (true);

-- Only the inviter can insert their own invites.
drop policy if exists "pending_invites_insert_own" on public.pending_invites;
create policy "pending_invites_insert_own" on public.pending_invites
  for insert with check (auth.uid() = inviter_user_id);

-- Only the inviter or the claimer can update (for claim-on-signup).
drop policy if exists "pending_invites_update_authorized" on public.pending_invites;
create policy "pending_invites_update_authorized" on public.pending_invites
  for update using (
    auth.uid() = inviter_user_id or auth.uid() = claimed_by_user_id
  );

-- =========================================================================
-- Scoring prompts — per-user override of the excitement-score system prompt.
-- When the user overrides a score, we log it as a calibration delta so future
-- scoring stays aligned with their taste.
-- =========================================================================

create table if not exists public.scoring_prompts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  prompt text not null,
  updated_at timestamptz not null default now()
);

alter table public.scoring_prompts enable row level security;

drop policy if exists "scoring_prompts_select_own" on public.scoring_prompts;
create policy "scoring_prompts_select_own" on public.scoring_prompts
  for select using (auth.uid() = user_id);

drop policy if exists "scoring_prompts_upsert_own" on public.scoring_prompts;
create policy "scoring_prompts_upsert_own" on public.scoring_prompts
  for insert with check (auth.uid() = user_id);

drop policy if exists "scoring_prompts_update_own" on public.scoring_prompts;
create policy "scoring_prompts_update_own" on public.scoring_prompts
  for update using (auth.uid() = user_id);

create table if not exists public.scoring_calibrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  ai_score integer,
  user_score integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists scoring_calibrations_user_idx
  on public.scoring_calibrations (user_id, created_at desc);

alter table public.scoring_calibrations enable row level security;

drop policy if exists "scoring_calibrations_select_own" on public.scoring_calibrations;
create policy "scoring_calibrations_select_own" on public.scoring_calibrations
  for select using (auth.uid() = user_id);

drop policy if exists "scoring_calibrations_insert_own" on public.scoring_calibrations;
create policy "scoring_calibrations_insert_own" on public.scoring_calibrations
  for insert with check (auth.uid() = user_id);
