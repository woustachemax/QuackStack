import fs from "fs";
import path from "path";
import { scanDir } from "../lib/scanner.js";
import { chunkText } from "../lib/chunker.js";
import { getEmbeddings } from "../lib/embeddings.js";
import { saveToDB } from "../lib/database.js";

const PROJECT_NAME = "quackstack";

async function ingest(rootDir: string) {
  console.log("Starting ingestion...");
  const files = await scanDir(rootDir);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const chunks = chunkText(content);

    for (const chunk of chunks) {
      const embedding = await getEmbeddings(chunk);
      await saveToDB({
        content: chunk,
        embedding,
        filePath,
        projectName: PROJECT_NAME,
        language: path.extname(filePath),
      });
    }
    console.log(`Processed ${filePath}`);
  }

  console.log("Done!");
}

export { ingest };
