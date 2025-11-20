#!/usr/bin/env node

import { client } from "../lib/database.js";
import { localEmbeddings } from "../lib/local-embeddings.js";
import { getAIClient } from "../lib/ai-provider.js";

export async function search(
  query: string,
  projectName: string,
  provider?: string,
  model?: string
) {
  const snippets = await client.codeSnippet.findMany({
    where: { projectName },
  });

  const allContent = snippets.map(s => s.content);
  localEmbeddings.addDocuments(allContent);

  const queryVector = localEmbeddings.getVector(query);

  const ranked = snippets
    .map(snippet => ({
      id: snippet.id,
      content: snippet.content,
      filePath: snippet.filePath,
      functionName: snippet.functionName,
      score: localEmbeddings.cosineSimilarity(queryVector, snippet.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score);

  const seenFiles = new Set<string>();
  const uniqueResults = ranked.filter(item => {
    if (seenFiles.has(item.filePath)) return false;
    seenFiles.add(item.filePath);
    return true;
  }).slice(0, 5);

  const context = uniqueResults
    .map((r, i) => `[${i + 1}] ${r.filePath}${r.functionName ? ` (${r.functionName})` : ""}\n${r.content}`)
    .join("\n\n---\n\n");

  const aiClient = getAIClient(provider as any, model);
  const answer = await aiClient.generateAnswer(query, context);
  
  return { answer, sources: uniqueResults };
}