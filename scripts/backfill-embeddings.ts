import { createClient } from "@supabase/supabase-js";
import { getEmbedding } from "../lib/embeddings";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfill() {
  const { data: rows, error } = await supabase
    .from("twin_profiles")
    .select("user_id, goals, deal_preferences")
    .is("goals_embedding", null);

  if (error) {
    console.error("Failed to fetch profiles:", error);
    return;
  }

  console.log(`Found ${rows?.length ?? 0} profile(s) missing embeddings`);

  for (const row of rows ?? []) {
    console.log(`Processing ${row.user_id}...`);

    const goalsEmb = row.goals ? await getEmbedding(row.goals) : null;
    const dealEmb = row.deal_preferences ? await getEmbedding(row.deal_preferences) : null;

    const { error: updateErr } = await supabase
      .from("twin_profiles")
      .update({
        goals_embedding: goalsEmb,
        deal_prefs_embedding: dealEmb
      })
      .eq("user_id", row.user_id);

    if (updateErr) {
      console.error(`Failed to update ${row.user_id}:`, updateErr);
    } else {
      console.log(`✅ Backfilled ${row.user_id}`);
    }
  }

  console.log("Done.");
}

backfill();