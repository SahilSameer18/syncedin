import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Toggle funny_mode on a conversation. Auth-gated to participants.
 * Returns the new state so the client can update its UI.
 *
 * GET → returns current value.
 * POST { funny_mode: boolean } → updates + returns new value.
 */
async function gate(req: Request, conversationId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const service = createServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("id, participant_a, participant_b, funny_mode")
    .eq("id", conversationId)
    .single();
  if (!conv) {
    return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  if (
    conv.participant_a !== user.id &&
    conv.participant_b !== user.id
  ) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user, service, conv };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const g = await gate(req, params.id);
  if ("error" in g) return g.error;
  return NextResponse.json({
    funny_mode: (g.conv as any).funny_mode ?? false
  });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const g = await gate(req, params.id);
  if ("error" in g) return g.error;
  let body: { funny_mode?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const next = !!body.funny_mode;
  try {
    const { error } = await g.service
      .from("conversations")
      .update({ funny_mode: next })
      .eq("id", params.id);
    if (error) {
      return NextResponse.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "update_failed", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
  return NextResponse.json({ funny_mode: next });
}
