#!/usr/bin/env node

import { client } from "../lib/database.js";
import { localEmbeddings } from "../lib/local-embeddings.js";
import { getAIClient } from "../lib/ai-provider.js";

interface SearchOptions {
  boostRecent?: boolean;
  boostFrequent?: boolean;
  filterAuthor?: string;
  recentDays?: number;
}

export async function search(
  query: string,
  projectName: string,
  provider?: string,
  model?: string,
  options: SearchOptions = {}
) {
  const {
    boostRecent = false,
    boostFrequent = false,
    filterAuthor,
    recentDays = 30,
  } = options;

  const whereClause: any = { projectName };
  
  if (filterAuthor) {
    whereClause.OR = [
      { lastCommitEmail: filterAuthor },
      { primaryAuthorEmail: filterAuthor },
    ];
  }

  const snippets = await client.codeSnippet.findMany({
    where: whereClause,
  });

  const allContent = snippets.map(s => s.content);
  localEmbeddings.addDocuments(allContent);

  const queryVector = localEmbeddings.getVector(query);

  const ranked = snippets
    .map(snippet => {
      let score = localEmbeddings.cosineSimilarity(queryVector, snippet.embedding as number[]);
      
      if (boostRecent && snippet.lastCommitDate) {
        const daysSinceCommit = (Date.now() - snippet.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCommit <= recentDays) {
          const recencyBoost = 1 + (0.2 * (1 - daysSinceCommit / recentDays));
          score *= recencyBoost;
        }
      }

      if (boostFrequent && snippet.totalCommits) {
        const commitBoost = 1 + (Math.min(snippet.totalCommits, 50) / 50) * 0.15;
        score *= commitBoost;
      }

      return {
        id: snippet.id,
        content: snippet.content,
        filePath: snippet.filePath,
        functionName: snippet.functionName,
        score,
        lastCommitAuthor: snippet.lastCommitAuthor,
        lastCommitDate: snippet.lastCommitDate,
        lastCommitMessage: snippet.lastCommitMessage,
        totalCommits: snippet.totalCommits,
        primaryAuthor: snippet.primaryAuthor,
      };
    })
    .sort((a, b) => b.score - a.score);

  const seenFiles = new Set<string>();
  const uniqueResults = ranked.filter(item => {
    if (seenFiles.has(item.filePath)) return false;
    seenFiles.add(item.filePath);
    return true;
  }).slice(0, 5);

  const context = uniqueResults
    .map((r, i) => {
      let entry = `[${i + 1}] ${r.filePath}${r.functionName ? ` (${r.functionName})` : ""}`;
      
      if (r.lastCommitAuthor || r.primaryAuthor) {
        const author = r.primaryAuthor || r.lastCommitAuthor;
        entry += `\nPrimary Author: ${author}`;
        
        if (r.totalCommits) {
          entry += ` (${r.totalCommits} commits)`;
        }
      }
      
      if (r.lastCommitDate) {
        const daysAgo = Math.floor((Date.now() - r.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
        entry += `\nLast Modified: ${daysAgo} days ago`;
        
        if (r.lastCommitMessage) {
          entry += `\nLast Commit: "${r.lastCommitMessage.substring(0, 60)}${r.lastCommitMessage.length > 60 ? '...' : ''}"`;
        }
      }
      
      entry += `\n\n${r.content}`;
      return entry;
    })
    .join("\n\n---\n\n");

  const aiClient = getAIClient(provider as any, model);
  
  const enhancedPrompt = query + 
    "\n\nNote: Code snippets include git history metadata (authors, commit counts, last modified dates). " +
    "Use this information to provide context about code ownership and recency when relevant.";
  
  const answer = await aiClient.generateAnswer(enhancedPrompt, context);
  
  return { answer, sources: uniqueResults };
}

export async function searchByAuthor(
  authorEmail: string,
  projectName: string
) {
  const snippets = await client.codeSnippet.findMany({
    where: {
      projectName,
      OR: [
        { lastCommitEmail: authorEmail },
        { primaryAuthorEmail: authorEmail },
      ],
    },
    select: {
      filePath: true,
      functionName: true,
      totalCommits: true,
      lastCommitDate: true,
    },
    orderBy: {
      totalCommits: "desc",
    },
  });


  const fileMap = new Map<string, any>();
  snippets.forEach(s => {
    if (!fileMap.has(s.filePath)) {
      fileMap.set(s.filePath, s);
    }
  });

  return Array.from(fileMap.values());
}

export async function getRecentActivity(projectName: string, days: number = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snippets = await client.codeSnippet.findMany({
    where: {
      projectName,
      lastCommitDate: {
        gte: since,
      },
    },
    select: {
      filePath: true,
      lastCommitAuthor: true,
      lastCommitDate: true,
      lastCommitMessage: true,
    },
    orderBy: {
      lastCommitDate: "desc",
    },
    take: 20,
  });

  const fileMap = new Map<string, any>();
  snippets.forEach(s => {
    if (!fileMap.has(s.filePath)) {
      fileMap.set(s.filePath, s);
    }
  });

  return Array.from(fileMap.values());
}