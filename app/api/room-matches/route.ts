import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTopMatchesInRoom } from "@/lib/roomMatching";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ matches: [] });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const conferenceSlug = body?.conferenceSlug;
    if (!conferenceSlug) {
      return NextResponse.json({ matches: [] });
    }

    const matches = await getTopMatchesInRoom(user.id, conferenceSlug, 5);
    return NextResponse.json({ matches });
  } catch (err: any) {
    console.error("[room-matches] error:", err);
    return NextResponse.json({ matches: [] });
  }
}
