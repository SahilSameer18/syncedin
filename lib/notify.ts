/**
 * Notification dispatch layer.
 *
 * Each notify* function:
 *   1. Looks up the recipient profile + their notification_preferences.
 *   2. Checks the relevant toggle. Defaults to true if the row doesn't exist.
 *   3. Generates a stable dedupe_key so we never double-send (e.g. on retries).
 *   4. Inserts notification_log row; on unique-violation, bails silently.
 *   5. Sends the email via lib/email.
 *
 * Everything is fire-and-forget from the caller's perspective. We catch all
 * errors and log — a failed notification should never block the underlying
 * action (new conversation, new message, accept agreement).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail, renderEmailHtml } from "@/lib/email";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://syncedin.org";

type Prefs = {
  user_id: string;
  email_address: string | null;
  on_new_connection: boolean;
  on_new_message: boolean;
  on_agreement_accepted: boolean;
  on_call_scheduled: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

async function loadRecipient(
  userId: string
): Promise<{ profile: ProfileRow; prefs: Prefs } | null> {
  const service = createServiceClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", userId)
      .maybeSingle(),
    service
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
  ]);
  if (!profile) return null;
  const effectivePrefs: Prefs = {
    user_id: userId,
    email_address: prefs?.email_address ?? null,
    on_new_connection: prefs?.on_new_connection ?? true,
    on_new_message: prefs?.on_new_message ?? true,
    on_agreement_accepted: prefs?.on_agreement_accepted ?? true,
    on_call_scheduled: prefs?.on_call_scheduled ?? true
  };
  return { profile: profile as ProfileRow, prefs: effectivePrefs };
}

async function logAndSend(args: {
  userId: string;
  kind: string;
  dedupeKey: string;
  subjectId?: string | null;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const service = createServiceClient();
  // Reserve the dedupe slot first. If insert fails on unique constraint, we've
  // already sent this notification.
  const { error: logErr } = await service.from("notification_log").insert({
    user_id: args.userId,
    kind: args.kind,
    subject_id: args.subjectId ?? null,
    dedupe_key: args.dedupeKey,
    email_address: args.to
  });
  if (logErr) {
    // Duplicate (already sent) is the common case; quietly skip.
    if (!/duplicate|unique/i.test(logErr.message || "")) {
      console.warn("[notify] log insert failed", args.kind, logErr.message);
    }
    return;
  }
  const result = await sendEmail({
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html
  });
  if (!result.ok) {
    console.warn("[notify] send failed", args.kind, result.error);
  }
}

function firstName(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim()) {
    return displayName.trim().split(/\s+/)[0];
  }
  if (email) {
    return email.split("@")[0];
  }
  return "there";
}

// ---------------------------------------------------------------------------
// New connection — when a fresh conversation is created between two users.
// Notify BOTH participants (each one independently subject to their prefs).
// ---------------------------------------------------------------------------

export async function notifyNewConnection(opts: {
  conversationId: string;
  participantA: string;
  participantB: string;
}): Promise<void> {
  try {
    await Promise.all([
      notifyOneNewConnection(
        opts.conversationId,
        opts.participantA,
        opts.participantB
      ),
      notifyOneNewConnection(
        opts.conversationId,
        opts.participantB,
        opts.participantA
      )
    ]);
  } catch (e) {
    console.warn("[notify] new-connection threw", e);
  }
}

async function notifyOneNewConnection(
  conversationId: string,
  recipientId: string,
  otherId: string
): Promise<void> {
  const recipient = await loadRecipient(recipientId);
  const other = await loadRecipient(otherId);
  if (!recipient || !other) return;
  if (!recipient.prefs.on_new_connection) return;
  const to = recipient.prefs.email_address || recipient.profile.email;
  if (!to) return;
  // Don't email test personas.
  const service = createServiceClient();
  const { data: isPersona } = await service
    .from("profiles")
    .select("is_test_persona")
    .eq("id", recipientId)
    .maybeSingle();
  if (isPersona?.is_test_persona) return;

  const otherName =
    other.profile.display_name || other.profile.email || "Someone";
  const recipFirst = firstName(
    recipient.profile.display_name,
    recipient.profile.email
  );
  const convUrl = `${APP_URL}/conversations/${conversationId}`;
  const subject = `${otherName} connected with your twin`;
  const text = `Hey ${recipFirst},\n\n${otherName} just started a conversation with your twin on SyncedIn. Your twins are negotiating now — open the thread to see what they're working out and chime in whenever you want.\n\n${convUrl}\n\n— SyncedIn`;
  const html = renderEmailHtml({
    preheader: `${otherName} just connected with your twin.`,
    heading: `${otherName} connected with your twin`,
    body: `<p>Hey ${firstName(recipient.profile.display_name, recipient.profile.email)},</p><p>Your twins are negotiating now. Open the thread to see what they're working out — you can edit any message before it sends.</p>`,
    ctaText: "Open conversation",
    ctaUrl: convUrl,
    footerNote: `You're getting this because new connections are on in your notification settings.`
  });
  await logAndSend({
    userId: recipientId,
    kind: "new_connection",
    dedupeKey: `new_connection:${conversationId}:${recipientId}`,
    subjectId: conversationId,
    to,
    subject,
    text,
    html
  });
}

// ---------------------------------------------------------------------------
// New message — debounced to "first new message in 10 minutes since the
// recipient last sent." We don't want a buzz for every twin-to-twin volley.
// ---------------------------------------------------------------------------

export async function notifyNewMessage(opts: {
  conversationId: string;
  messageId: string;
  senderUserId: string;
}): Promise<void> {
  try {
    const service = createServiceClient();
    const { data: conv } = await service
      .from("conversations")
      .select("participant_a, participant_b")
      .eq("id", opts.conversationId)
      .maybeSingle();
    if (!conv) return;
    const recipientId =
      conv.participant_a === opts.senderUserId
        ? conv.participant_b
        : conv.participant_a;
    if (recipientId === opts.senderUserId) return;

    const recipient = await loadRecipient(recipientId);
    if (!recipient) return;
    if (!recipient.prefs.on_new_message) return;
    const to = recipient.prefs.email_address || recipient.profile.email;
    if (!to) return;

    // Skip test personas.
    const { data: isPersona } = await service
      .from("profiles")
      .select("is_test_persona")
      .eq("id", recipientId)
      .maybeSingle();
    if (isPersona?.is_test_persona) return;

    // Debounce: if we already sent a new_message notification for this
    // conversation in the last 30 minutes, skip.
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: recentLog } = await service
      .from("notification_log")
      .select("id")
      .eq("user_id", recipientId)
      .eq("kind", "new_message")
      .eq("subject_id", opts.conversationId)
      .gte("sent_at", since)
      .limit(1)
      .maybeSingle();
    if (recentLog) return;

    const sender = await loadRecipient(opts.senderUserId);
    const senderName =
      sender?.profile.display_name || sender?.profile.email || "Your twin";
    const convUrl = `${APP_URL}/conversations/${opts.conversationId}`;
    const recipFirst = firstName(
      recipient.profile.display_name,
      recipient.profile.email
    );
    const subject = `${senderName} (or their twin) sent something new`;
    const text = `Hey ${recipFirst},\n\nNew activity in your conversation with ${senderName}. Open the thread to read it.\n\n${convUrl}\n\n— SyncedIn`;
    const html = renderEmailHtml({
      preheader: `New activity from ${senderName}.`,
      heading: `New message from ${senderName}`,
      body: `<p>Hey ${recipFirst},</p><p>Your conversation with ${senderName} just updated. You can edit any draft your twin proposes before it gets sent.</p>`,
      ctaText: "Open conversation",
      ctaUrl: convUrl,
      footerNote: `Debounced to one alert per 30 minutes. Manage in notification settings.`
    });

    // Use messageId in the dedupe key so we never double-send the same message.
    await logAndSend({
      userId: recipientId,
      kind: "new_message",
      dedupeKey: `new_message:${opts.messageId}:${recipientId}`,
      subjectId: opts.conversationId,
      to,
      subject,
      text,
      html
    });
  } catch (e) {
    console.warn("[notify] new-message threw", e);
  }
}

// ---------------------------------------------------------------------------
// Agreement accepted — fires for both participants when both have accepted.
// ---------------------------------------------------------------------------

export async function notifyAgreementSealed(opts: {
  conversationId: string;
}): Promise<void> {
  try {
    const service = createServiceClient();
    const { data: conv } = await service
      .from("conversations")
      .select("participant_a, participant_b")
      .eq("id", opts.conversationId)
      .maybeSingle();
    if (!conv) return;
    await Promise.all([
      sendAgreementOne(opts.conversationId, conv.participant_a, conv.participant_b),
      sendAgreementOne(opts.conversationId, conv.participant_b, conv.participant_a)
    ]);
  } catch (e) {
    console.warn("[notify] agreement-sealed threw", e);
  }
}

async function sendAgreementOne(
  conversationId: string,
  recipientId: string,
  otherId: string
): Promise<void> {
  const recipient = await loadRecipient(recipientId);
  const other = await loadRecipient(otherId);
  if (!recipient || !other) return;
  if (!recipient.prefs.on_agreement_accepted) return;
  const to = recipient.prefs.email_address || recipient.profile.email;
  if (!to) return;

  const service = createServiceClient();
  const { data: isPersona } = await service
    .from("profiles")
    .select("is_test_persona")
    .eq("id", recipientId)
    .maybeSingle();
  if (isPersona?.is_test_persona) return;

  const otherName =
    other.profile.display_name || other.profile.email || "Your counterpart";
  const recipFirst = firstName(
    recipient.profile.display_name,
    recipient.profile.email
  );
  const convUrl = `${APP_URL}/conversations/${conversationId}`;
  const subject = `Deal: you & ${otherName} both agreed`;
  const text = `Hey ${recipFirst},\n\nYou and ${otherName} both accepted the proposed agreement. Time to make it real.\n\n${convUrl}\n\n— SyncedIn`;
  const html = renderEmailHtml({
    preheader: `You and ${otherName} both accepted the agreement.`,
    heading: `It's a deal with ${otherName}`,
    body: `<p>Hey ${recipFirst},</p><p>You both accepted the proposed agreement. Time to take it into the real world — schedule a call, send the doc, ship the thing.</p>`,
    ctaText: "Open conversation",
    ctaUrl: convUrl,
    footerNote: `Agreement notifications are on. Manage in notification settings.`
  });
  await logAndSend({
    userId: recipientId,
    kind: "agreement_accepted",
    dedupeKey: `agreement_accepted:${conversationId}:${recipientId}`,
    subjectId: conversationId,
    to,
    subject,
    text,
    html
  });
}

// ---------------------------------------------------------------------------
// Call scheduled — when a twin proposes a meeting time the user confirms.
// Used by the future "schedule a call" UI; safe to wire now.
// ---------------------------------------------------------------------------

export async function notifyCallScheduled(opts: {
  conversationId: string;
  recipientId: string;
  callTimeIso: string;
  callDescription?: string;
}): Promise<void> {
  try {
    const recipient = await loadRecipient(opts.recipientId);
    if (!recipient) return;
    if (!recipient.prefs.on_call_scheduled) return;
    const to = recipient.prefs.email_address || recipient.profile.email;
    if (!to) return;
    const convUrl = `${APP_URL}/conversations/${opts.conversationId}`;
    const when = new Date(opts.callTimeIso).toLocaleString();
    const recipFirst = firstName(
      recipient.profile.display_name,
      recipient.profile.email
    );
    const subject = `Call scheduled: ${when}`;
    const text = `Hey ${recipFirst},\n\nYour twin scheduled a call: ${when}. ${opts.callDescription || ""}\n\n${convUrl}\n\n— SyncedIn`;
    const html = renderEmailHtml({
      preheader: `Call scheduled for ${when}.`,
      heading: `Call scheduled — ${when}`,
      body: `<p>Hey ${recipFirst},</p><p>Your twin locked in a call.</p>${opts.callDescription ? `<p><em>${opts.callDescription}</em></p>` : ""}`,
      ctaText: "Open conversation",
      ctaUrl: convUrl
    });
    await logAndSend({
      userId: opts.recipientId,
      kind: "call_scheduled",
      dedupeKey: `call_scheduled:${opts.conversationId}:${opts.callTimeIso}`,
      subjectId: opts.conversationId,
      to,
      subject,
      text,
      html
    });
  } catch (e) {
    console.warn("[notify] call-scheduled threw", e);
  }
}
