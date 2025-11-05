import readline from "readline";
import chalk from "chalk";
import { search } from "./commands/search.js";
import { ingest } from "./commands/ingest.js";
import { client } from "./lib/database.js";
import path from "path";
import { detectFileChanges, formatChangeMessage } from "./lib/file-change-detector.js";

const PROJECT_NAME = path.basename(process.cwd());

export async function startREPL(forceReindex: boolean = false) {
  console.log(chalk.cyan("\n💡 Tip: Press Ctrl+C to exit\n"));

  if (!forceReindex) {
    const changes = await detectFileChanges(process.cwd(), PROJECT_NAME);
    
    if (changes && changes.totalChanges > 0) {
      console.log(chalk.yellow(`\n⚠️  Detected ${changes.totalChanges} file change${changes.totalChanges > 1 ? 's' : ''} since last index:`));
      console.log(chalk.yellow(`   ${formatChangeMessage(changes)}`));
      console.log(chalk.yellow(`   Run 'quack --reindex' for best results.\n`));
      
      const shouldReindex = await promptUser(
        chalk.yellow("Would you like to reindex now? (y/n) > ")
      );
      
      if (shouldReindex.toLowerCase() === 'y') {
        forceReindex = true;
      }
    }
  }

  const existingCount = await client.codeSnippet.count({
    where: { projectName: PROJECT_NAME },
  });

  if (existingCount === 0 || forceReindex) {
    if (forceReindex) {
      console.log(chalk.gray("🗑️  Clearing old index..."));
      await client.codeSnippet.deleteMany({
        where: { projectName: PROJECT_NAME },
      });
    }

    console.log(chalk.gray("🔍 Indexing your codebase (this may take a moment)..."));
    await ingest(process.cwd(), PROJECT_NAME, true);
    console.log(chalk.green("✅ Indexing complete!"));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.yellow("🐥 Quack! How can I help? > "),
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const query = line.trim();
    if (!query) {
      rl.prompt();
      return;
    }

    try {
      const { answer, sources } = await search(query, PROJECT_NAME);

      console.log(chalk.white(`\n${answer}\n`));

      const showDetails = await promptUser(
        chalk.cyan("💡 Want more details? (y/n) > ")
      );

      if (showDetails.toLowerCase() === "y") {
        console.log(chalk.blue("\n📚 Relevant Code:\n"));
        sources.forEach((src, i) => {
          console.log(
            chalk.gray(`[${i + 1}] ${src.filePath} (relevance: ${(src.score * 100).toFixed(1)}%)`)
          );
          console.log(chalk.white(src.content));
          console.log(chalk.gray("\n---\n"));
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(chalk.gray("\n👋 Happy coding!"));
    process.exit(0);
  });
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}