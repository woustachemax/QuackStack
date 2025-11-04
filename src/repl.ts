import readline from "readline";
import chalk from "chalk";
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

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'))  
    .replace(/\*(.+?)\*/g, chalk.italic('$1'))     
    .replace(/`(.+?)`/g, chalk.cyan('$1'))         
    .replace(/^#{1,6}\s+(.+)$/gm, chalk.bold.blue('$1')); 
}

export async function startREPL(forceReindex = false) {
  await ensureIngested(forceReindex);
  
  console.log("💡 Tip: Press Ctrl+C to exit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  let waitingForDetails = false;
  let currentSources: any[] = [];

  rl.on("line", async (input: string) => {
    const trimmed = input.trim().toLowerCase();
    
    if (waitingForDetails) {
      waitingForDetails = false;
      
      if (trimmed === "y" || trimmed === "yes") {
        console.log("\n📚 Relevant Code:\n");
        currentSources.slice(0, 3).forEach((r, i) => {
          console.log(chalk.dim(`[${i + 1}] ${r.filePath} (relevance: ${(r.score * 100).toFixed(1)}%)`));
          console.log(chalk.gray(r.content));
          console.log(chalk.dim("---\n"));
        });
      }
      
      console.log();
      rl.prompt();
      return;
    }

    if (!trimmed) {
      rl.prompt();
      return;
    }

    try {
      const { answer, sources } = await search(input, PROJECT_NAME);
      currentSources = sources;
      
      console.log("\n" + stripMarkdown(answer) + "\n");
      
      waitingForDetails = true;
      process.stdout.write("💡 Want more details? (y/n) > ");
      
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error instanceof Error ? error.message : "Unknown error");
      rl.prompt();
    }
  });

  rl.on("close", () => {
    console.log("\n👋 Happy coding!");
    process.exit(0);
  });

  rl.setPrompt("🐥 Quack! How can I help? > ");
  rl.prompt();
}