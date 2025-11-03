import fs from "fs";
import path from "path";
import { scanDir } from "../lib/scanner.js";
import { chunkCode } from "../lib/chunker.js";
import { aiClient } from "../lib/ai-provider.js";
import { saveToDB } from "../lib/database.js";

export async function ingest(
  rootDir: string, 
  projectName: string,
  silent = false
) {
  if (!silent) console.log("Starting ingestion...");
  
  const files = await scanDir(rootDir);
  
  if (!silent) console.log(`Found ${files.length} files to process`);

  let processedCount = 0;
  
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const chunks = chunkCode(content, filePath);

      for (const chunk of chunks) {
        const embedding = await aiClient.getEmbeddings(chunk.content);
        await saveToDB({
          content: chunk.content,
          embedding,
          filePath,
          projectName,
          language: path.extname(filePath),
          functionName: chunk.functionName,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
        });
      }
      
      processedCount++;
      if (!silent && processedCount % 10 === 0) {
        console.log(`Processed ${processedCount}/${files.length} files...`);
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  if (!silent) console.log(`Done! Processed ${processedCount} files.`);
}