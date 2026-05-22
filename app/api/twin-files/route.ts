import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Twin-files API — metadata index for files the user uploads as
 * twin context (resumes, pitch decks, lists of businesses they
 * run) and files the twin can share inside conversations. Storage
 * lives in the Supabase Storage bucket "twin-files" (must be
 * created manually); this route handles only the metadata + the
 * signed-URL upload flow.
 *
 * GET → list this user's files
 * POST { name, mime_type, size_bytes, kind?, description? } → reserves
 *   a metadata row + returns a signed upload URL the client can PUT to
 * DELETE ?id=<file_id> → remove file + storage object
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const { data } = await service
    .from("twin_files")
    .select(
      "id, name, size_bytes, mime_type, storage_path, kind, description, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ files: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    name?: string;
    mime_type?: string;
    size_bytes?: number;
    kind?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 200);
  const mime = (body.mime_type ?? "application/octet-stream").slice(0, 80);
  const size = Math.max(0, Math.min(50_000_000, Number(body.size_bytes) || 0));
  const kind = body.kind === "shareable" ? "shareable" : "context";
  const description = (body.description ?? "").trim().slice(0, 500) || null;
  if (!name) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }
  const service = createServiceClient();
  // Generate a unique storage path scoped by user — RLS on the storage
  // bucket should restrict reads/writes to the owning user only.
  const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100);
  const storage_path = `${user.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;
  const { data: row, error } = await service
    .from("twin_files")
    .insert({
      user_id: user.id,
      name,
      mime_type: mime,
      size_bytes: size,
      storage_path,
      kind,
      description
    })
    .select("id, storage_path")
    .single();
  if (error || !row) {
    return NextResponse.json(
      { error: "insert_failed", detail: error?.message },
      { status: 500 }
    );
  }
  // Create a signed upload URL the client can PUT to.
  const { data: signed, error: signErr } = await service.storage
    .from("twin-files")
    .createSignedUploadUrl(storage_path);
  if (signErr || !signed) {
    // Roll back the metadata row so we don't leave orphaned entries.
    await service.from("twin_files").delete().eq("id", row.id);
    return NextResponse.json(
      {
        error: "sign_failed",
        detail:
          signErr?.message ??
          "Storage bucket 'twin-files' must exist — create it in Supabase Storage."
      },
      { status: 500 }
    );
  }
  return NextResponse.json({
    file_id: row.id,
    storage_path: row.storage_path,
    upload_url: signed.signedUrl,
    upload_token: signed.token
  });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const service = createServiceClient();
  const { data: row } = await service
    .from("twin_files")
    .select("user_id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await service.storage.from("twin-files").remove([row.storage_path]);
  } catch {
    /* best-effort */
  }
  await service.from("twin_files").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
