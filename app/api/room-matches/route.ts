import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTopMatchesInRoom } from "@/lib/roomMatching";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { conferenceSlug } = await req.json();
  if (!conferenceSlug) {
    return NextResponse.json({ error: "Missing conferenceSlug" }, { status: 400 });
  }

  try {
    const matches = await getTopMatchesInRoom(user.id, conferenceSlug, 5);
    return NextResponse.json({ matches });
  } catch (err: any) {
    console.error("[room-matches] error:", err);
    return NextResponse.json({ error: "Failed to compute matches" }, { status: 500 });
  }
}



