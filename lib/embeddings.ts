import { gemini } from "@/lib/gemini";

export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await gemini.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: { outputDimensionality: 768 }
    });
    return response.embeddings?.[0]?.values ?? null;
  } catch (err) {
    console.error("Embedding generation failed, will fall back:", err);
    return null;
  }
}