import readline from "readline";
import chalk from "chalk";
import { search } from "./commands/search.js";
import { ingest } from "./commands/ingest.js";
import { client } from "./lib/database.js";
import path from "path";
import { detectFileChanges, formatChangeMessage } from "./lib/file-change-detector.js";
import { getAIClient, resetAIClient } from "./lib/ai-provider.js";

const PROJECT_NAME = path.basename(process.cwd());

export async function startREPL(
  forceReindex: boolean = false,
  provider?: string,
  model?: string
) {
  console.log(chalk.cyan("\n🐥 Welcome to QuackStack!\n"));

  try {
    const aiClient = getAIClient(provider as any, model);
    console.log(chalk.cyan(`🤖 Using: ${aiClient.getProviderName()} - ${aiClient.getModel()}`));
    console.log(chalk.gray("💡 Tip: Type '/help' for commands or 'quack --list-models' to see all options"));
    console.log(chalk.cyan("⚡ Press Ctrl+C to exit\n"));
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Failed to initialize AI provider: ${error.message}\n`));
    process.exit(1);
  }

  if (!forceReindex) {
    const changes = await detectFileChanges(process.cwd(), PROJECT_NAME);
    
    if (changes && changes.totalChanges > 0) {
      console.log(chalk.yellow(`\n⚠️  Detected ${changes.totalChanges} file change${changes.totalChanges > 1 ? 's' : ''} since last index:`));
      console.log(chalk.yellow(`   ${formatChangeMessage(changes)}`));
      console.log(chalk.yellow(`   Run 'quack --reindex' for best results.\n`));
      
      const shouldReindex = await promptUser(
        chalk.yellow("🔄 Reindex now? (y/n) > ")
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

    console.log(chalk.gray("🔍 Indexing your codebase..."));
    await ingest(process.cwd(), PROJECT_NAME, true);
    console.log(chalk.green("✅ Indexing complete\n"));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.yellow("🐥 quack > "),
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const query = line.trim();
    
    if (query.startsWith("/")) {
      await handleCommand(query, rl);
      rl.prompt();
      return;
    }

    if (!query) {
      rl.prompt();
      return;
    }

    try {
      const { answer, sources } = await search(query, PROJECT_NAME, provider as any, model);

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
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(chalk.gray("\n👋 Happy coding!\n"));
    process.exit(0);
  });
}

async function handleCommand(command: string, rl: readline.Interface) {
  const [cmd, ...args] = command.slice(1).split(" ");

  switch (cmd) {
    case "model":
    case "m":
      if (args.length === 0) {
        try {
          const client = getAIClient();
          console.log(chalk.cyan(`\n🤖 Current: ${client.getProviderName()} - ${client.getModel()}\n`));
        } catch (error: any) {
          console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
        }
      } else {
        const [newModel] = args;
        try {
          resetAIClient();
          const client = getAIClient(undefined, newModel);
          console.log(chalk.green(`\n✅ Switched to: ${client.getProviderName()} - ${client.getModel()}\n`));
        } catch (error: any) {
          console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
        }
      }
      break;

    case "provider":
    case "p":
      if (args.length === 0) {
        try {
          const client = getAIClient();
          const providers = client.getAvailableProviders();
          console.log(chalk.cyan("\n🔌 Available Providers:\n"));
          providers.forEach(p => {
            const current = p.provider === client.getProvider() ? chalk.green(" ← current") : "";
            console.log(chalk.white(`  • ${p.provider}: ${p.name}${current}`));
          });
          console.log();
        } catch (error: any) {
          console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
        }
      } else {
        const [newProvider] = args;
        try {
          resetAIClient();
          const client = getAIClient(newProvider as any);
          console.log(chalk.green(`\n✅ Switched to: ${client.getProviderName()} - ${client.getModel()}\n`));
        } catch (error: any) {
          console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
        }
      }
      break;

    case "help":
    case "h":
      console.log(chalk.cyan("\n📖 Available Commands:\n"));
      console.log(chalk.white("  /model, /m [model]    Show or change model"));
      console.log(chalk.white("  /provider, /p [name]  Show or change provider"));
      console.log(chalk.white("  /help, /h             Show this help"));
      console.log();
      break;

    default:
      console.log(chalk.red(`\n❌ Unknown command: ${cmd}\n`));
      console.log(chalk.gray("💡 Type /help for available commands\n"));
  }
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