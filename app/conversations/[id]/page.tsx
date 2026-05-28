import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasAgreement, MAX_AUTO_TURNS } from "@/lib/twin-prompt";
import { ChatUI } from "./ChatUI";
import { ConversationRail } from "./ConversationRail";
import { Sidebar } from "../../Sidebar";
import { MobileShell } from "../../MobileShell";
import { SitewidePrefetch } from "../../SitewidePrefetch";
import { signOut } from "../../login/actions";
import { TopBar } from "../../TopBar";
import { SyncMeter } from "../../SyncMeter";
import Link from "next/link";
import type { Message, AgreementResponse } from "@/lib/types";

export default async function ConversationPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!conv) notFound();
  if (conv.participant_a !== user.id && conv.participant_b !== user.id) {
    notFound();
  }

  const otherId =
    conv.participant_a === user.id ? conv.participant_b : conv.participant_a;

  const service = createServiceClient();
  const [{ data: otherProfile }, { data: selfProfile }] = await Promise.all([
    service
      .from("profiles")
      // Pull the public social URLs alongside the basics so the
      // conversation header can render the clickable LinkedIn / X / IG /
      // Facebook / website pills next to the counterpart's name.
      .select(
        "id, display_name, email, is_test_persona, avatar_url, linkedin_url, x_url, instagram_url, facebook_url, website_url"
      )
      .eq("id", otherId)
      .single(),
    service
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .eq("id", user.id)
      .single()
  ]);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.id)
    .order("sent_at", { ascending: true });

  const { data: responses } = await supabase
    .from("agreement_responses")
    .select("*")
    .eq("conversation_id", params.id);

  const msgs = (messages as Message[]) ?? [];
  const last = msgs[msgs.length - 1];
  const done =
    msgs.length >= MAX_AUTO_TURNS ||
    (Boolean(last) && hasAgreement(last.final_text));

  const resps = (responses as AgreementResponse[]) ?? [];
  const myResponse = resps.find((r) => r.user_id === user.id) ?? null;
  const otherResponse = resps.find((r) => r.user_id === otherId) ?? null;

  // Sidebar data — same shape AppShell normally fetches. We render the
  // Sidebar manually as a fixed-position element here (instead of using
  // AppShell) because ChatUI owns the full h-screen layout and we don't
  // want to nest <main> tags or fight ChatUI's mx-auto centering. The
  // sidebar floats over the left edge of the viewport, the convo rail
  // sits right after it, ChatUI's mx-auto centering is unaffected.
  //
  // Per Jack: every page should share the SAME elements — TopBar, the
  // unread-count badges, the Clone Sync card. The old version skipped
  // them and that's why opening a conversation made the 7 Messages
  // badge disappear. Now we fetch the same data AppShell does.
  const userId = user.id;
  const { data: profileForSidebar } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, email, handle")
    .eq("id", userId)
    .maybeSingle();
  function prettifyEmailUsername(raw: string): string {
    const parts = raw
      .replace(/[._-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return parts
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ");
  }
  const emailUsername = user.email?.split("@")[0] ?? "";
  const sidebarDisplayName =
    (profileForSidebar?.display_name &&
      profileForSidebar.display_name.trim()) ||
    (emailUsername ? prettifyEmailUsername(emailUsername) : "you");
  let conferences: { slug: string; name: string }[] = [];
  try {
    const { data: memberRows } = await supabase
      .from("conference_members")
      .select("conference_slug")
      .eq("user_id", userId);
    const slugs = (memberRows ?? []).map((r: any) => r.conference_slug);
    if (slugs.length > 0) {
      const { data: confs } = await supabase
        .from("conferences")
        .select("slug, name")
        .in("slug", slugs);
      conferences = (confs ?? []).map((c: any) => ({
        slug: c.slug as string,
        name: c.name as string
      }));
    }
  } catch {
    /* sidebar still renders without conferences section */
  }

  // Unread counts — mirrors AppShell's parallel fetch so badges show
  // up identically on the conversation page (Jack flagged: opening a
  // chat made the "7 messages" badge vanish).
  const unreadCounts: Record<string, number> = {};
  async function computeMessagesUnread(): Promise<number> {
    const { data: convs } = await supabase
      .from("conversations")
      .select(
        "id, participant_a, participant_b, last_read_a, last_read_b, created_at"
      )
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
    const myConvs = (convs ?? []) as any[];
    const convIds = myConvs.map((c) => c.id);
    if (convIds.length === 0) return 0;
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, sender_user_id, sent_at")
      .in("conversation_id", convIds)
      .neq("sender_user_id", userId)
      .order("sent_at", { ascending: false });
    const latestByConv = new Map<string, string>();
    for (const m of ((msgs ?? []) as any[])) {
      if (!latestByConv.has(m.conversation_id)) {
        latestByConv.set(m.conversation_id, m.sent_at);
      }
    }
    let n = 0;
    for (const c of myConvs) {
      const isA = c.participant_a === userId;
      const myLastRead = isA ? c.last_read_a : c.last_read_b;
      const latest = latestByConv.get(c.id);
      if (!latest) continue;
      if (!myLastRead || new Date(latest) > new Date(myLastRead)) n += 1;
    }
    return n;
  }
  async function computePollUnread(): Promise<number> {
    const { data: polls } = await supabase
      .from("polls")
      .select("id, status")
      .neq("status", "closed");
    const pollIds = ((polls ?? []) as any[]).map((p) => p.id);
    if (pollIds.length === 0) return 0;
    const { data: myResponses } = await supabase
      .from("poll_responses")
      .select("poll_id")
      .eq("twin_user_id", userId)
      .in("poll_id", pollIds);
    const respondedSet = new Set(
      ((myResponses ?? []) as any[]).map((r) => r.poll_id)
    );
    return pollIds.filter((id: string) => !respondedSet.has(id)).length;
  }
  async function computeProposalsUnread(): Promise<number> {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, participant_a, participant_b, summary")
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .not("summary", "is", null);
    const convIds = ((convs ?? []) as any[]).map((c) => c.id);
    if (convIds.length === 0) return 0;
    const { data: myResps } = await supabase
      .from("agreement_responses")
      .select("conversation_id")
      .eq("user_id", userId)
      .in("conversation_id", convIds);
    const respondedSet = new Set(
      ((myResps ?? []) as any[]).map((r) => r.conversation_id)
    );
    return convIds.filter((id: string) => !respondedSet.has(id)).length;
  }
  const [mRes, pRes, prRes] = await Promise.allSettled([
    computeMessagesUnread(),
    computePollUnread(),
    computeProposalsUnread()
  ]);
  if (mRes.status === "fulfilled" && mRes.value > 0)
    unreadCounts["/messages"] = mRes.value;
  if (pRes.status === "fulfilled" && pRes.value > 0)
    unreadCounts["/poll"] = pRes.value;
  if (prRes.status === "fulfilled" && prRes.value > 0)
    unreadCounts["/proposals"] = prRes.value;

  // Clone Sync card — same sidebarExtra slot the dashboard passes to
  // AppShell. Fetched twin data is light here (just goals); SyncMeter
  // tolerates missing fields. We don't pass conversation/edit counts
  // since this is the chat page and the meter is meant as a quick
  // glance, not a precise score.
  const { data: twinForMeter } = await supabase
    .from("twin_profiles")
    .select(
      "goals, deal_preferences, communication_style, deal_breakers, ai_export_blob"
    )
    .eq("user_id", userId)
    .maybeSingle();
  const syncInputs = {
    name: profileForSidebar?.display_name ?? null,
    goals: (twinForMeter as any)?.goals ?? null,
    ai_export_blob: (twinForMeter as any)?.ai_export_blob ?? null,
    deal_preferences: (twinForMeter as any)?.deal_preferences ?? null,
    comm_style: (twinForMeter as any)?.communication_style ?? null,
    deal_breakers: (twinForMeter as any)?.deal_breakers ?? null,
    hometown: null,
    current_city: null,
    completed_conversations: 0,
    accepted_agreements: 0,
    edit_count: 0
  };
  // Clone-sync card — passed INTO Sidebar via its cloneCard prop so
  // it renders inside the same panel as the nav. No own background /
  // border / overflow:hidden (the Sidebar panel already provides the
  // surface; clipping here was hiding the (i) tooltip).
  const cloneSyncCard = (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        paddingTop: 8,
        borderTop: "1px solid var(--border)"
      }}
    >
      <SyncMeter
        inputs={syncInputs}
        size={110}
        avatarUrl={(profileForSidebar as any)?.avatar_url ?? null}
        userId={userId}
      />
      <Link
        href="/onboarding"
        className="retro-btn retro-btn-primary text-center"
        style={{
          width: "100%",
          fontSize: 11,
          padding: "7px 10px"
        }}
      >
        + add context
      </Link>
    </aside>
  );

  const sidebarEl = (
    <Sidebar
      userId={userId}
      displayName={sidebarDisplayName}
      avatarUrl={(profileForSidebar as any)?.avatar_url ?? null}
      signOutAction={signOut}
      conferences={conferences}
      unreadCounts={unreadCounts}
      // Pass the clone-sync card INTO the Sidebar so it renders inside
      // the same panel as the nav — matches what AppShell does on every
      // other page. Previously the conversation page rendered the
      // sidebar AND a separate cloneSyncCard aside, which produced a
      // duplicate SyncMeter floating below the sidebar with its glow
      // clipping off the left edge. Jack: "UI overlap error on desktop."
      cloneCard={cloneSyncCard}
    />
  );

  return (
    <>
      {/* Mobile chrome — hamburger top bar + slide-in drawer holding
          the full sidebar. Hidden on lg+. */}
      <MobileShell>{sidebarEl}</MobileShell>

      {/* Warm the router cache for every primary nav destination. */}
      <SitewidePrefetch />

      {/* Desktop top bar — same Hypernetwork / Sync a conference /
          Sync a community items + profile dropdown as every other page.
          Jack: "the real way to win here is gonna be keeping it all
          same." */}
      <div className="hidden lg:block">
        <TopBar
          userId={userId}
          displayName={sidebarDisplayName}
          avatarUrl={(profileForSidebar as any)?.avatar_url ?? null}
          portfolioHandle={(profileForSidebar as any)?.handle ?? null}
          signOutAction={signOut}
          unreadCounts={unreadCounts}
        />
      </div>

      {/* Desktop left sidebar — fixed-position so ChatUI's h-screen
          layout doesn't need to know about it. Hidden on mobile (the
          MobileShell drawer handles nav there). The Clone Sync card
          is now embedded INSIDE the Sidebar via the cloneCard prop,
          so the whole thing is one panel — no duplicate floating
          meter, no left-edge clipping. */}
      <aside
        className="hidden lg:flex lg:flex-col"
        style={{
          position: "fixed",
          top: 64,
          bottom: 16,
          left: 16,
          width: 220,
          // Bumped 4 → 10 so the SyncMeter (i) tooltip floats ABOVE
          // the conversation rail (z:6) and the new conv-action-rail
          // (z:6). The sidebar + those rails don't visually overlap
          // (they sit at different x positions), so the higher
          // z-index is purely about the tooltip popping OUT of the
          // sidebar's bounds. Jack: "on the conversation page, when
          // I hover over my sync score, it is behind the vertical
          // conversation list."
          zIndex: 10,
          overflowY: "visible",
          overflowX: "visible"
        }}
      >
        {sidebarEl}
      </aside>

      {/* Conversation rail — narrow strip TO THE RIGHT of the main
          sidebar, showing other convos. Was previously at left:16, now
          at left:252 to clear the 220px sidebar + a 16px gap. */}
      <ConversationRail activeId={params.id} />
      <ChatUI
      conversationId={params.id}
      selfUserId={user.id}
      selfName={selfProfile!.display_name ?? selfProfile!.email}
      selfEmail={selfProfile!.email ?? null}
      selfAvatarUrl={(selfProfile as any)?.avatar_url ?? null}
      other={{
        id: otherProfile!.id,
        name: otherProfile!.display_name ?? otherProfile!.email,
        email: otherProfile!.email ?? null,
        isTestPersona: otherProfile!.is_test_persona,
        avatarUrl: (otherProfile as any)?.avatar_url ?? null,
        socials: {
          linkedin_url: (otherProfile as any)?.linkedin_url ?? null,
          x_url: (otherProfile as any)?.x_url ?? null,
          instagram_url: (otherProfile as any)?.instagram_url ?? null,
          facebook_url: (otherProfile as any)?.facebook_url ?? null,
          website_url: (otherProfile as any)?.website_url ?? null
        }
      }}
      initialMessages={msgs}
      initialDone={done}
      // Surface the persisted outcome summary on first load so the user
      // doesn't have to click "summarize" — the existing summary card
      // renders at the top of the chat automatically.
      initialSummary={
        (conv as any)?.summary
          ? {
              summary: (conv as any).summary as string,
              counterpart_summary:
                ((conv as any).counterpart_summary as string) ?? "",
              excitement_score:
                Number((conv as any).excitement_score) || 0
            }
          : null
      }
      // Read receipt — counterpart's last_read_* timestamp. ChatUI
      // compares each outgoing message's sent_at against this to choose
      // between ✓ (delivered) and ✓✓ (read by counterpart).
      otherLastReadAt={
        ((conv as any)?.[
          conv.participant_a === user.id ? "last_read_b" : "last_read_a"
        ] as string | null) ?? null
      }
      initialMyResponse={
        myResponse ? { response: myResponse.response } : null
      }
      initialOtherResponse={
        otherResponse
          ? { response: otherResponse.response, reason: otherResponse.reason }
          : null
      }
    />
    </>
  );
}
