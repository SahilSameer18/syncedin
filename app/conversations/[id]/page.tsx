import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasAgreement, MAX_AUTO_TURNS } from "@/lib/twin-prompt";
import { ChatUI } from "./ChatUI";
import { ConversationRail } from "./ConversationRail";
import { Sidebar } from "../../Sidebar";
import { MobileShell } from "../../MobileShell";
import { SitewidePrefetch } from "../../SitewidePrefetch";
import { signOut } from "../../login/actions";
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
  const { data: profileForSidebar } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();
  const sidebarDisplayName =
    profileForSidebar?.display_name || user.email?.split("@")[0] || "you";
  let conferences: { slug: string; name: string }[] = [];
  try {
    const { data: memberRows } = await supabase
      .from("conference_members")
      .select("conference_slug")
      .eq("user_id", user.id);
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

  const sidebarEl = (
    <Sidebar
      userId={user.id}
      displayName={sidebarDisplayName}
      avatarUrl={(profileForSidebar as any)?.avatar_url ?? null}
      signOutAction={signOut}
      conferences={conferences}
    />
  );

  return (
    <>
      {/* Mobile chrome — hamburger top bar + slide-in drawer holding
          the full sidebar. Hidden on lg+. */}
      <MobileShell>{sidebarEl}</MobileShell>

      {/* Warm the router cache for every primary nav destination. */}
      <SitewidePrefetch />

      {/* Desktop left sidebar — fixed-position so ChatUI's h-screen
          layout doesn't need to know about it. Hidden on mobile (the
          MobileShell drawer handles nav there). */}
      <aside
        className="hidden lg:block"
        style={{
          position: "fixed",
          top: 16,
          bottom: 16,
          left: 16,
          width: 220,
          zIndex: 4,
          // Sidebar content (Dashboard / Messages / Invite / Poll /
          // conferences list / Hypernetwork / + new conversation / sign
          // out + dark toggle) can naturally exceed viewport height once
          // a user has a few conferences. Constrain to viewport - 32px
          // (top:16 + bottom:16) and scroll internally so it never bleeds
          // off the bottom of the page.
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto"
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
