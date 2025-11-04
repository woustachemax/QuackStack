#!/usr/bin/env node

import { aiClient } from "../lib/ai-provider.js";
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

type SearchResult = {
  id: number;
  content: string;
  filePath: string;
  functionName: string | null;
  score: number;
};

export async function search(query: string, projectName: string) {
  const queryEmbedding = await aiClient.getEmbeddings(query);
  const snippets = await client.codeSnippet.findMany({
    where: { projectName },
  });

  const scored = snippets.map(snippet => ({
    id: snippet.id,
    content: snippet.content,
    filePath: snippet.filePath,
    functionName: snippet.functionName,
    score: cosineSim(queryEmbedding, snippet.embedding as number[]),
  }));

  scored.sort((a, b) => b.score - a.score);

  const seenFiles = new Set<string>();
  const ranked = scored.filter(item => {
    if (seenFiles.has(item.filePath)) {
      return false;
    }
    seenFiles.add(item.filePath);
    return true;
  }).slice(0, 5);

  const context = ranked
    .map((r, i) => `[${i + 1}] ${r.filePath}${r.functionName ? ` (${r.functionName})` : ""}\n${r.content}`)
    .join("\n\n---\n\n");

  const answer = await aiClient.generateAnswer(query, context);
  
  return { answer, sources: ranked };
}