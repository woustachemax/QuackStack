#!/usr/bin/env node

import { getEmbeddings } from "../lib/embeddings.js";
import { client } from "../lib/database.js";

function cosineSim(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function search(query: string, projectName = "quackstack") {
  const queryEmbedding = await getEmbeddings(query);
  const snippets = await client.codeSnippet.findMany({
    where: { projectName },
  });

  const ranked = snippets
    .map(snippet => ({
      ...snippet,
      score: cosineSim(queryEmbedding, snippet.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return ranked;
}
