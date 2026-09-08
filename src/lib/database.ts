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

interface CommitData {
  hash: string;
  projectName: string;
  authorName: string;
  authorEmail: string;
  agentName: string | null;
  agentConfidence: string;
  sessionId: string | null;
  message: string;
  authoredAt: Date;
}

interface CommitFileData {
  commitHash: string;
  projectName: string;
  filePath: string;
  functionsTouched: Array<{ name: string | null; lineStart: number | null; lineEnd: number | null }>;
}

export async function clearCommits(projectName: string) {
  await client.commitFile.deleteMany({ where: { projectName } });
  await client.commit.deleteMany({ where: { projectName } });
}

export async function saveCommit(data: CommitData) {
  await client.commit.upsert({
    where: { hash: data.hash },
    create: data,
    update: {
      agentName: data.agentName,
      agentConfidence: data.agentConfidence,
      sessionId: data.sessionId,
      message: data.message,
    },
  });
}

export async function saveCommitFiles(rows: CommitFileData[]) {
  if (rows.length === 0) return;
  await client.commitFile.createMany({
    data: rows.map((r) => ({
      commitHash: r.commitHash,
      projectName: r.projectName,
      filePath: r.filePath,
      functionsTouched: r.functionsTouched,
    })),
    skipDuplicates: true,
  });
}

export async function getProjectCommits(projectName: string) {
  return await client.commit.findMany({
    where: { projectName },
    include: { files: true },
    orderBy: { authoredAt: "asc" },
  });
}

export async function getCommitByHash(hash: string) {
  return await client.commit.findUnique({
    where: { hash },
    include: { files: true },
  });
}

export async function getFunctionAtLine(projectName: string, filePath: string, line: number) {
  const snippets = await client.codeSnippet.findMany({
    where: {
      projectName,
      filePath,
      functionName: { not: null },
      lineStart: { lte: line },
      lineEnd: { gte: line },
    },
    select: { functionName: true, lineStart: true, lineEnd: true },
    orderBy: { lineStart: "desc" },
  });
  return snippets[0] || null;
}

export async function clearProject(projectName: string) {
  await client.commitFile.deleteMany({
    where: { projectName },
  });
  await client.commit.deleteMany({
    where: { projectName },
  });
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