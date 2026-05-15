import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exaPeopleSearch, type ExaPerson } from "@/lib/exa";

/**
 * Find a person to start a conversation with — by name OR email.
 *
 * Returns two lists:
 *   sync_users  – matches inside SyncedIn (clickable → start convo)
 *   exa_people  – suggestions from the open web (clickable → invite + draft)
 *
 * If the query looks like an email, we do an exact email lookup first and
 * skip Exa (no point — we know who they are).
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  const service = createServiceClient();
  const isEmail = query.includes("@") && query.includes(".");

  // ── SyncedIn search ────────────────────────────────────────────────
  type SyncUser = {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  let sync_users: SyncUser[] = [];

  if (isEmail) {
    const { data } = await service
      .from("profiles")
      .select("id, display_name, email")
      .eq("email", query.toLowerCase())
      .limit(5);
    sync_users = (data ?? []) as SyncUser[];
  } else {
    // Match by display_name OR email containing the query, exclude self.
    const { data } = await service
      .from("profiles")
      .select("id, display_name, email")
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .neq("id", user.id)
      .limit(8);
    sync_users = (data ?? []) as SyncUser[];
  }

  // ── Exa fallback for context / discovery ────────────────────────────
  let exa_people: ExaPerson[] = [];
  if (!isEmail) {
    try {
      exa_people = await exaPeopleSearch(query, 6);
    } catch (e) {
      // Non-fatal — Exa is a "nice to have" here.
      console.error("exa lookup in find-counterpart failed", e);
    }
  }

  return NextResponse.json({ sync_users, exa_people });
}
