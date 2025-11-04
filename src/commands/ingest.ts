import fs from "fs";
import path from "path";
import { scanDir } from "../lib/scanner.js";
import { chunkCode } from "../lib/chunker.js";
import { saveToDB } from "../lib/database.js";
import { localEmbeddings } from "../lib/local-embeddings.js";
export async function ingest(
  rootDir: string, 
  projectName: string,
  silent = false
) {
  if (!silent) console.log("Starting ingestion...");
  
  const files = await scanDir(rootDir);
  
  if (!silent) console.log(`Found ${files.length} files to process`);

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

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async ({ content, filePath, chunk }) => {
      const embedding = localEmbeddings.getVector(content);
      
      await saveToDB({
        content,
        embedding,
        filePath,
        projectName,
        language: path.extname(filePath),
        functionName: chunk.functionName,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
      });
    }));

    processedCount += batch.length;
    if (!silent && processedCount % 100 === 0) {
      console.log(`Saved ${processedCount}/${allChunks.length} chunks...`);
    }
  }

  if (!silent) console.log(`Done! Processed ${processedCount} chunks from ${files.length} files.`);
}