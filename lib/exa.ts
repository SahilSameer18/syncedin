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
export async function exaPeopleSearch(
  query: string,
  numResults = 8
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
      contents: { highlights: true }
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
    highlights: (r.highlights as string[]) ?? []
  }));
}
