import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function getEmbedding(text: string): Promise<number[]> {
  const response = await gemini.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return response.embeddings[0].values;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

async function test() {
  try {
    const embA = await getEmbedding("I need a technical co-founder");
    const embB = await getEmbedding("I'm a senior engineer looking to join an early-stage startup");
    const embC = await getEmbedding("I love hiking on weekends");

    console.log("Similar meaning (co-founder vs engineer):", cosineSimilarity(embA, embB));
    console.log("Unrelated meaning (co-founder vs hiking):", cosineSimilarity(embA, embC));
  } catch (err) {
    console.error("FAILED:", err);
  }
}


test();


console.log("--- RUN COMPLETE ---");
