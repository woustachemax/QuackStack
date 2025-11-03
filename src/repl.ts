import readline from "readline";
import { ingest } from "./commands/ingest.js";
import { search } from "./commands/search.js";
import { client } from "./lib/database.js";
import path from "path";

const PROJECT_NAME = path.basename(process.cwd());

async function ensureIngested(forceReindex = false) {
  const count = await client.codeSnippet.count({ 
    where: { projectName: PROJECT_NAME } 
  });
  
  if (count === 0 || forceReindex) {
    if (forceReindex && count > 0) {
      console.log("🗑️  Clearing old index...");
      await client.codeSnippet.deleteMany({ 
        where: { projectName: PROJECT_NAME } 
      });
    }
    
    console.log("🔍 Indexing your codebase (this may take a moment)...");
    await ingest(process.cwd(), PROJECT_NAME, true); 
    console.log("✅ Indexing complete!\n");
  }
}

export async function startREPL(forceReindex = false) {
  await ensureIngested(forceReindex);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "🐥 Quack! How can I help? > "
  });

  console.log("💡 Tip: Press Ctrl+C to exit\n");
  rl.prompt();

  rl.on("line", async (input) => {
    const trimmed = input.trim();
    
    if (!trimmed) {
      rl.prompt();
      return;
    }

    try {
      const { answer, sources } = await search(trimmed, PROJECT_NAME);
      console.log(`\n${answer}\n`);
      
      await new Promise<void>((resolve) => {
        const detailRL = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        detailRL.question("💡 Want more details? (y/n) > ", (ans) => {
          if (ans.toLowerCase() === "y") {
            console.log("\n📚 Relevant Code:\n");
            sources.slice(0, 3).forEach((r, i) => {
              console.log(`[${i + 1}] ${r.filePath} (relevance: ${(r.score * 100).toFixed(1)}%)`);
              console.log(`${r.content}\n`);
              console.log("---\n");
            });
          }
          detailRL.close();
          console.log();
          resolve();
        });
      });
      
    } catch (error) {
      console.error("❌ Error:", error instanceof Error ? error.message : "Unknown error");
    }
    
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\n👋 Happy coding!");
    process.exit(0);
  });
}