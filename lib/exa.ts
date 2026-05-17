// Exa search — find real people worth inviting/connecting with.
// Raw fetch (no SDK dependency). Docs: https://docs.exa.ai

const EXA_SEARCH = "https://api.exa.ai/search";

export type ExaPerson = {
  title: string; // usually "Name – role/company"
  url: string;
  highlights: string[]; // query-relevant excerpts about them
};

/**
 * People search. `category: "people"` returns person results; highlights are
 * short excerpts Exa pulls that match the query.
 */
/**
 * Strip markdown artifacts Exa pulls out of LinkedIn ("[...]", "###", "**", etc.)
 * so the rendered card looks like prose, not a raw scrape.
 */
function cleanHighlight(s: string): string {
  return s
    .replace(/\[\.\.\.\]/g, " ")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function exaPeopleSearch(
  query: string,
  numResults = 15
): Promise<ExaPerson[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new Error("EXA_API_KEY is not set in the environment.");
  }

  const res = await fetch(EXA_SEARCH, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query,
      category: "people",
      type: "auto",
      numResults,
      // Pull more (and longer) highlights per person so the expanded card is
      // actually useful when the user clicks to read it.
      contents: { highlights: { numSentences: 4, highlightsPerUrl: 3 } }
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Exa search failed (HTTP ${res.status}): ${detail.slice(0, 240)}`
    );
  }

  const json = await res.json();
  return ((json.results as any[]) ?? []).map((r) => ({
    title: (r.title as string) || (r.author as string) || (r.url as string),
    url: r.url as string,
    highlights: ((r.highlights as string[]) ?? [])
      .map(cleanHighlight)
      .filter(Boolean)
  }));
}
