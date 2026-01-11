import { PrismaClient } from "@prisma/client";

export const client = new PrismaClient();

interface CodeSnippetData {
  content: string;
  embedding: number[];
  filePath: string;
  projectName: string;
  language?: string;
  functionName?: string;
  lineStart?: number;
  lineEnd?: number;
  lastCommitHash?: string;
  lastCommitAuthor?: string;
  lastCommitEmail?: string;
  lastCommitDate?: Date;
  lastCommitMessage?: string;
  totalCommits?: number;
  primaryAuthor?: string;
  primaryAuthorEmail?: string;
  fileOwnerCommits?: number;
}

interface AuthorData {
  projectName: string;
  author: string;
  email: string;
  totalCommits: number;
  linesAdded: number;
  linesRemoved: number;
  recentActivity?: Date;
  filesOwned: string[];
}

export async function saveToDB(data: CodeSnippetData) {
  await client.codeSnippet.create({
    data: {
      content: data.content,
      embedding: data.embedding,
      filePath: data.filePath,
      projectName: data.projectName,
      language: data.language,
      functionName: data.functionName,
      lineStart: data.lineStart,
      lineEnd: data.lineEnd,
      lastCommitHash: data.lastCommitHash,
      lastCommitAuthor: data.lastCommitAuthor,
      lastCommitEmail: data.lastCommitEmail,
      lastCommitDate: data.lastCommitDate,
      lastCommitMessage: data.lastCommitMessage,
      totalCommits: data.totalCommits,
      primaryAuthor: data.primaryAuthor,
      primaryAuthorEmail: data.primaryAuthorEmail,
      fileOwnerCommits: data.fileOwnerCommits,
    },
  });
}

export async function saveAuthorToDB(data: AuthorData) {
  await client.gitAuthor.upsert({
    where: {
      projectName_email: {
        projectName: data.projectName,
        email: data.email,
      },
    },
    create: data,
    update: {
      author: data.author,
      totalCommits: data.totalCommits,
      linesAdded: data.linesAdded,
      linesRemoved: data.linesRemoved,
      recentActivity: data.recentActivity,
      filesOwned: data.filesOwned,
    },
  });
}

export async function clearProject(projectName: string) {
  await client.codeSnippet.deleteMany({
    where: { projectName },
  });
  await client.gitAuthor.deleteMany({
    where: { projectName },
  });
}

export async function getProjectAuthors(projectName: string) {
  return await client.gitAuthor.findMany({
    where: { projectName },
    orderBy: { totalCommits: "desc" },
  });
}

export async function getAuthorFiles(projectName: string, authorEmail: string) {
  const snippets = await client.codeSnippet.findMany({
    where: {
      projectName,
      primaryAuthorEmail: authorEmail,
    },
    select: {
      filePath: true,
      functionName: true,
      totalCommits: true,
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

export async function getRecentlyModifiedFiles(projectName: string, days: number = 7) {
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
  });


  const fileMap = new Map<string, any>();
  snippets.forEach(s => {
    if (!fileMap.has(s.filePath)) {
      fileMap.set(s.filePath, s);
    }
  });

  return Array.from(fileMap.values());
}