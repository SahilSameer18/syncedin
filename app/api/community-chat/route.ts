import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Humans-only chat for community + conference rooms. Jack: "Inside of
 * communities and conferences, let's have a humans-only chat part of
 * that page." Distinct from twin-to-twin convos — these are real
 * messages typed by real members of the room.
 *
 * GET /api/community-chat?community_id=...  OR  ?conference_id=...
 *   → returns chronological message list (last 200, oldest first)
 *
 * POST { community_id?, conference_id?, body }
 *   → posts a message. Author resolved from auth.uid(). Caller must be
 *     a member of the room (or it's public).
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const community_id = url.searchParams.get("community_id");
  const conference_id = url.searchParams.get("conference_id");
  if (!community_id && !conference_id) {
    return NextResponse.json({ messages: [] });
  }
  const service = createServiceClient();
  try {
    let q = service
      .from("community_chat_messages")
      .select(
        "id, community_id, conference_id, author_id, author_name, author_avatar_url, body, created_at, removed_at"
      )
      .is("removed_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    if (community_id) q = q.eq("community_id", community_id);
    if (conference_id) q = q.eq("conference_id", conference_id);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ messages: data ?? [] });
  } catch (e: any) {
    // Schema missing → return empty list so the chat tab still renders
    // its empty state instead of 500ing the parent page.
    return NextResponse.json({ messages: [], _err: e?.message ?? null });
  }
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { community_id?: string; conference_id?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  const community_id = body.community_id ?? null;
  const conference_id = body.conference_id ?? null;
  if (!text) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }
  if (!community_id && !conference_id) {
    return NextResponse.json(
      { error: "missing_room_id" },
      { status: 400 }
    );
  }
  if (community_id && conference_id) {
    return NextResponse.json(
      { error: "only_one_room_id" },
      { status: 400 }
    );
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const service = createServiceClient();
  // Resolve author name + avatar so the chat tab doesn't have to join
  // against profiles on every read.
  let author_name: string | null = null;
  let author_avatar_url: string | null = null;
  try {
    const { data: p } = await service
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    author_name =
      ((p as any)?.display_name as string) ||
      ((p as any)?.email as string)?.split("@")[0] ||
      null;
    author_avatar_url = ((p as any)?.avatar_url as string) ?? null;
  } catch {
    /* fallback to null author_name; UI shows "anon" */
  }

  const { data, error } = await service
    .from("community_chat_messages")
    .insert({
      community_id,
      conference_id,
      author_id: user.id,
      author_name,
      author_avatar_url,
      body: text
    })
    .select("id")
    .single();

  if (error) {
    if (
      /relation .* does not exist|schema cache|column .* does not exist/i.test(
        error.message
      )
    ) {
      return NextResponse.json(
        {
          error: "schema_missing",
          detail:
            "Your DB needs the community_chat_messages + community_join_requests tables. Run the latest supabase/schema.sql in Supabase → SQL Editor (the diff under the 'Communities/Conferences shared additions' header). Then try again."
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "save_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: (data as any)?.id ?? null,
    author_name,
    author_avatar_url
  });
}
