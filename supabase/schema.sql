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
alter table public.profiles
  add column if not exists avatar_url text;
-- Public portfolio fields. `handle` is the URL slug at /u/<handle> — auto-
-- derived from display_name when the user finishes onboarding (see
-- onboarding save action). `portfolio_about` is freeform MySpace-style
-- copy the user can edit directly OR via the prompt-driven editor.
-- `portfolio_theme` stores visual customization (accent color, banner emoji,
-- vibe label) as JSONB so the prompt editor can rewrite it without schema
-- changes.
alter table public.profiles
  add column if not exists handle text unique;
alter table public.profiles
  add column if not exists portfolio_about text;
alter table public.profiles
  add column if not exists portfolio_theme jsonb;
create index if not exists profiles_handle_idx
  on public.profiles (lower(handle));

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

-- Why did you make this edit? Captured at edit time. Meta-learning signal
-- that lets future drafts internalize the user's worldview, not just their
-- word choices.
alter table public.edit_deltas
  add column if not exists reason text;

-- Location signals — used to bias Exa results toward people in the user's
-- geographic orbit (hometown + current city).
alter table public.twin_profiles
  add column if not exists hometown text;
alter table public.twin_profiles
  add column if not exists current_city text;

-- =========================================================================
-- Conferences — a conference head signs up, gets a shareable join URL,
-- and discovery within that conference is limited to fellow members.
-- =========================================================================

create table if not exists public.conferences (
  slug text primary key,
  name text not null,
  description text,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  cover_url text,
  starts_at date,
  ends_at date,
  city text,
  -- 'conference' (one-time event) or 'community' (ongoing group). Same
  -- mechanics, different landing copy + sidebar label + URL prefix.
  kind text not null default 'conference'
    check (kind in ('conference', 'community')),
  created_at timestamptz not null default now()
);

-- Idempotent column add for existing deployments.
alter table public.conferences
  add column if not exists kind text not null default 'conference';
alter table public.conferences
  drop constraint if exists conferences_kind_check;
alter table public.conferences
  add constraint conferences_kind_check check (kind in ('conference', 'community'));

create index if not exists conferences_owner_idx
  on public.conferences (owner_user_id);

alter table public.conferences enable row level security;

drop policy if exists "conferences_public_read" on public.conferences;
create policy "conferences_public_read" on public.conferences
  for select using (true);

drop policy if exists "conferences_insert_own" on public.conferences;
create policy "conferences_insert_own" on public.conferences
  for insert with check (auth.uid() = owner_user_id);

drop policy if exists "conferences_update_own" on public.conferences;
create policy "conferences_update_own" on public.conferences
  for update using (auth.uid() = owner_user_id);

drop policy if exists "conferences_delete_own" on public.conferences;
create policy "conferences_delete_own" on public.conferences
  for delete using (auth.uid() = owner_user_id);

create table if not exists public.conference_members (
  conference_slug text not null references public.conferences(slug) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conference_slug, user_id)
);

create index if not exists conference_members_user_idx
  on public.conference_members (user_id);

alter table public.conference_members enable row level security;

-- Members can read the member list of conferences they're in (for discovery).
drop policy if exists "conf_members_read_if_member" on public.conference_members;
create policy "conf_members_read_if_member" on public.conference_members
  for select using (
    exists (
      select 1 from public.conference_members me
      where me.conference_slug = conference_members.conference_slug
        and me.user_id = auth.uid()
    )
    or exists (
      select 1 from public.conferences c
      where c.slug = conference_members.conference_slug
        and c.owner_user_id = auth.uid()
    )
  );

-- Anyone signed in can join (the join endpoint validates the slug exists).
drop policy if exists "conf_members_insert_self" on public.conference_members;
create policy "conf_members_insert_self" on public.conference_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "conf_members_delete_self" on public.conference_members;
create policy "conf_members_delete_self" on public.conference_members
  for delete using (auth.uid() = user_id);

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

-- Per-conversation goal override. Lets a single twin pivot what it's
-- pitching for THIS specific recipient without rewriting the head goal.
-- (Founder talking to investor → "raise"; same founder talking to candidate
--  → "hire"; same founder talking to journalist → "story angle".)
-- Null falls back to twin_profiles.goals. Set by the user from the
-- conversation page; downstream prompt builders read this first.
alter table public.conversations
  add column if not exists goal_override text;

-- Read receipts (WhatsApp-style ✓✓). Stamped on mount by each
-- participant. ChatUI uses these to render single-check (delivered) vs
-- double-check (read by counterpart) glyphs on outgoing messages.
alter table public.conversations
  add column if not exists last_read_a timestamptz;
alter table public.conversations
  add column if not exists last_read_b timestamptz;

-- Participants can UPDATE their conversations (needed for the excitement override).
drop policy if exists "conv_update_participant" on public.conversations;
create policy "conv_update_participant" on public.conversations
  for update using (
    auth.uid() = participant_a or auth.uid() = participant_b
  );

-- =========================================================================
-- Feedback / Requests — public Change.org style page where any signed-in
-- user can post a request and anyone can vote up or down.
-- =========================================================================

create table if not exists public.feedback_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  author_name text,
  title text not null,
  body text,
  category text default 'idea' check (
    category in ('idea', 'bug', 'feature', 'other')
  ),
  created_at timestamptz not null default now()
);

create index if not exists feedback_posts_created_idx
  on public.feedback_posts (created_at desc);

alter table public.feedback_posts enable row level security;

drop policy if exists "feedback_posts_public_read" on public.feedback_posts;
create policy "feedback_posts_public_read" on public.feedback_posts
  for select using (true);

drop policy if exists "feedback_posts_insert_own" on public.feedback_posts;
create policy "feedback_posts_insert_own" on public.feedback_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_posts_delete_own" on public.feedback_posts;
create policy "feedback_posts_delete_own" on public.feedback_posts
  for delete using (auth.uid() = user_id);

create table if not exists public.feedback_votes (
  post_id uuid not null references public.feedback_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists feedback_votes_post_idx
  on public.feedback_votes (post_id);

alter table public.feedback_votes enable row level security;

drop policy if exists "feedback_votes_public_read" on public.feedback_votes;
create policy "feedback_votes_public_read" on public.feedback_votes
  for select using (true);

drop policy if exists "feedback_votes_insert_own" on public.feedback_votes;
create policy "feedback_votes_insert_own" on public.feedback_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_votes_update_own" on public.feedback_votes;
create policy "feedback_votes_update_own" on public.feedback_votes
  for update using (auth.uid() = user_id);

drop policy if exists "feedback_votes_delete_own" on public.feedback_votes;
create policy "feedback_votes_delete_own" on public.feedback_votes
  for delete using (auth.uid() = user_id);

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

-- Recipient's public profile photo URL (scraped from IG / X / LinkedIn).
-- Used to embed the recipient's face into the OG card so each invite
-- landing page personalizes the iMessage / Twitter / WhatsApp preview.
alter table public.pending_invites
  add column if not exists recipient_avatar_url text;

-- Outbound DM (sent over SMS / email / WhatsApp / LinkedIn) — this is the
-- personalized role-aware cold message the inviter copies and sends. It
-- talks about THE RECIPIENT'S work and why a sync is interesting.
--
-- `conversation_starter` is now the LANDING-PAGE opener — what the
-- recipient sees inside /<slug> after they click through. That message is
-- platform-context: "Hey, I'm on a new platform where twins connect to
-- surface win-wins between us." The two messages serve different audiences
-- (the recipient before vs. after the click) and used to be identical,
-- which felt redundant.
alter table public.pending_invites
  add column if not exists outbound_message text;

-- Analytics columns — let us measure invite CTR + A/B test variants of
-- the outbound message + landing opener over time.
--   sent_at        : set when the inviter marks-as-sent in BulkReach
--   visit_count    : incremented every time the /<slug> landing page renders
--   first_visit_at : timestamp of the first /<slug> render
--   message_variant: e.g. "v1-recipient-first" so we can compare CTR per
--                    template across cohorts.
alter table public.pending_invites
  add column if not exists sent_at timestamptz;
alter table public.pending_invites
  add column if not exists visit_count integer not null default 0;
alter table public.pending_invites
  add column if not exists first_visit_at timestamptz;
alter table public.pending_invites
  add column if not exists message_variant text;

-- Recipient contact captured at draft time. Lets us credit the original
-- inviter when the recipient signs up via the front door (syncedin.org/
-- login) instead of the /claim/<slug> link. Without these we could only
-- count claim-flow conversions, which under-reports real conversions by
-- a lot.
alter table public.pending_invites
  add column if not exists recipient_email text;
alter table public.pending_invites
  add column if not exists recipient_phone text;
alter table public.pending_invites
  add column if not exists recipient_handle text;

create index if not exists pending_invites_recipient_email_idx
  on public.pending_invites (recipient_email);

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

-- =========================================================================
-- Notification preferences + send log
-- Per-user toggles for what gets emailed; log prevents duplicates.
-- =========================================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_address text, -- nullable: defaults to profiles.email
  on_new_connection boolean not null default true,
  on_new_message boolean not null default true,
  on_agreement_accepted boolean not null default true,
  on_call_scheduled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- New-match notifications: fires when someone new finishes their twin AND
-- their pair score against this user is above match_threshold. Default
-- threshold is 65 — high enough to feel like a real match alert, not a
-- "someone joined" firehose. Existing users who don't run the new schema
-- migration get the default via the COALESCE in lib/notify.
alter table public.notification_preferences
  add column if not exists on_new_match boolean not null default true;
alter table public.notification_preferences
  add column if not exists match_threshold integer not null default 65;

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs_select_own" on public.notification_preferences;
create policy "notif_prefs_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "notif_prefs_insert_own" on public.notification_preferences;
create policy "notif_prefs_insert_own" on public.notification_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "notif_prefs_update_own" on public.notification_preferences;
create policy "notif_prefs_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id);

create table if not exists public.notification_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, -- 'new_connection' | 'new_message' | 'agreement_accepted' | 'call_scheduled'
  subject_id uuid, -- conversation_id or other related row
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  email_address text,
  unique (user_id, dedupe_key)
);

create index if not exists notification_log_user_idx
  on public.notification_log (user_id, sent_at desc);

alter table public.notification_log enable row level security;

drop policy if exists "notif_log_select_own" on public.notification_log;
create policy "notif_log_select_own" on public.notification_log
  for select using (auth.uid() = user_id);

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

-- =========================================================================
-- POLLS — ask a question to every twin on the platform, synthesize the
-- collective answer. Each user can see how their own twin answered and
-- override it; overrides feed back into future synthesis runs.
-- =========================================================================

create table if not exists public.polls (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  question text not null,
  context text,                                  -- optional framing for the LLM
  status text not null default 'running',        -- 'running' | 'ready' | 'closed'
  synthesis text,                                -- LLM-generated paragraph summarizing all twins' answers
  synthesis_one_liner text,                      -- ≤140 char headline summary
  responses_count integer not null default 0,
  overrides_count integer not null default 0,
  created_at timestamptz not null default now(),
  synthesized_at timestamptz
);

create index if not exists polls_created_idx
  on public.polls (created_at desc);
create index if not exists polls_creator_idx
  on public.polls (created_by, created_at desc);

alter table public.polls enable row level security;

-- Everyone signed-in can read polls (they're network-wide).
drop policy if exists "polls_select_all_authed" on public.polls;
create policy "polls_select_all_authed" on public.polls
  for select using (auth.role() = 'authenticated');

drop policy if exists "polls_insert_own" on public.polls;
create policy "polls_insert_own" on public.polls
  for insert with check (auth.uid() = created_by);

drop policy if exists "polls_update_own" on public.polls;
create policy "polls_update_own" on public.polls
  for update using (auth.uid() = created_by);

create table if not exists public.poll_responses (
  id uuid primary key default uuid_generate_v4(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  twin_user_id uuid not null references public.profiles(id) on delete cascade,
  twin_response text not null,                   -- what the LLM generated as the twin's answer
  human_override text,                           -- user-provided correction (if any)
  was_overridden boolean not null default false,
  generated_at timestamptz not null default now(),
  overridden_at timestamptz,
  unique (poll_id, twin_user_id)
);

create index if not exists poll_responses_poll_idx
  on public.poll_responses (poll_id);
create index if not exists poll_responses_user_idx
  on public.poll_responses (twin_user_id, generated_at desc);

alter table public.poll_responses enable row level security;

drop policy if exists "poll_responses_select_all_authed" on public.poll_responses;
create policy "poll_responses_select_all_authed" on public.poll_responses
  for select using (auth.role() = 'authenticated');

-- Only the twin's owner can update their own response (override path).
drop policy if exists "poll_responses_update_own_twin" on public.poll_responses;
create policy "poll_responses_update_own_twin" on public.poll_responses
  for update using (auth.uid() = twin_user_id);
