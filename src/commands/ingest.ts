import fs from "fs";
import path from "path";
import { scanDir } from "../lib/scanner.js";
import { chunkCode } from "../lib/chunker.js";
import { saveToDB, saveAuthorToDB } from "../lib/database.js";
import { localEmbeddings } from "../lib/local-embeddings.js";
import { gitHistory, initGitHistory } from "../lib/git-history.js";

export async function ingest(
  rootDir: string, 
  projectName: string,
  silent = false,
  includeGitHistory = true
) {
  initGitHistory(rootDir);
  
  if (!silent) console.log("Starting ingestion...");
  
  const files = await scanDir(rootDir);
  
  if (!silent) console.log(`Found ${files.length} files to process`);


  const isGitRepo = gitHistory.isRepository();
  if (isGitRepo && includeGitHistory && !silent) {
    console.log(`Git repository detected - enriching with history data`);
  }

  const allChunks: Array<{ content: string; filePath: string; chunk: any }> = [];
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const chunks = chunkCode(content, filePath);
      chunks.forEach(chunk => {
        allChunks.push({ content: chunk.content, filePath, chunk });
      });
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
    }
  }

  if (!silent) console.log(`Computing embeddings for ${allChunks.length} chunks...`);

  const allContent = allChunks.map(c => c.content);
  localEmbeddings.addDocuments(allContent);

  if (!silent) console.log(`Saving to database...`);

  const BATCH_SIZE = 50;
  let processedCount = 0;


  const fileGitData = new Map<string, any>();

  if (isGitRepo && includeGitHistory) {
  
    for (const { filePath } of allChunks) {
      if (!fileGitData.has(filePath)) {
        const history = gitHistory.getFileHistory(filePath, 100);
        fileGitData.set(filePath, history);
      }
    }
  }

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async ({ content, filePath, chunk }) => {
      const embedding = localEmbeddings.getVector(content);
      
    
      let gitMetadata = {};
      if (isGitRepo && includeGitHistory) {
        const history = fileGitData.get(filePath);
        
        if (history && history.commits.length > 0) {
          const lastCommit = history.commits[0];
          const primaryAuthor = history.primaryAuthors[0];
          
          gitMetadata = {
            lastCommitHash: lastCommit.hash,
            lastCommitAuthor: lastCommit.author,
            lastCommitEmail: lastCommit.email,
            lastCommitDate: lastCommit.date,
            lastCommitMessage: lastCommit.message,
            totalCommits: history.totalCommits,
            primaryAuthor: primaryAuthor?.author,
            primaryAuthorEmail: primaryAuthor?.email,
            fileOwnerCommits: primaryAuthor?.commitCount,
          };
        }
      }
      
      await saveToDB({
        content,
        embedding,
        filePath,
        projectName,
        language: path.extname(filePath),
        functionName: chunk.functionName,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        ...gitMetadata,
      });
    }));

    processedCount += batch.length;
    if (!silent && processedCount % 100 === 0) {
      console.log(`Saved ${processedCount}/${allChunks.length} chunks...`);
    }
  }


  if (isGitRepo && includeGitHistory && !silent) {
    console.log("📈 Computing author statistics...");
    const authorStats = gitHistory.getAuthorStats();
    console.log(`Found ${authorStats.length} authors`);
    
    for (const stats of authorStats) {
    
      const ownedFiles: string[] = [];
      fileGitData.forEach((history, filePath) => {
        if (history?.primaryAuthors[0]?.email === stats.email) {
          ownedFiles.push(path.relative(gitHistory.getRepositoryRoot(), filePath));
        }
      });

      await saveAuthorToDB({
        projectName,
        author: stats.author,
        email: stats.email,
        totalCommits: stats.totalCommits,
        linesAdded: stats.linesAdded,
        linesRemoved: stats.linesRemoved,
        recentActivity: stats.recentActivity,
        filesOwned: ownedFiles,
      });
    }
    
    if (!silent) console.log(`✅ Stored stats for ${authorStats.length} contributors`);
  }

  if (!silent) {
    console.log(`Done! Processed ${processedCount} chunks from ${files.length} files.`);
    if (isGitRepo && includeGitHistory) {
      console.log(`Git history enrichment complete`);
    }
  }
}