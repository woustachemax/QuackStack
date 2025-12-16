#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import chalk from "chalk";
import { startREPL } from "./repl.js";
import { generateContextFiles, updateGlobalContext, watchAndUpdateContext } from "./lib/context-generator.js";
import { generateReadme } from "./commands/readme.js";
import { getAIClient } from "./lib/ai-provider.js";
import path from "path";

const program = new Command();
const PROJECT_NAME = path.basename(process.cwd());

program
  .name("QuackStack🐥")
  .description("Your cracked unpaid intern for all things codebase!")
  .version("1.0.5")
  .option("-r, --reindex", "Force reindex the codebase")
  .option("-c, --context", "Generate context files for ALL AI coding tools")
  .option("-d, --docs", "Generate CODEBASE.md")
  .option("--readme", "Generate README.md from your codebase")
  .option("--cursor", "[DEPRECATED] Use --context instead")
  .option("-w, --watch", "Watch mode: auto-update context files on file changes")
  .option("-p, --provider <provider>", "AI provider: openai, anthropic, gemini, deepseek, mistral, grok")
  .option("-m, --model <model>", "Specific model to use")
  .option("--list-models", "List available providers and models")
  .action(async (options) => {
    if (options.listModels) {
      const client = getAIClient();
      const providers = client.getAvailableProviders();
      
      console.log(chalk.cyan("\nAvailable AI Providers & Models:\n"));
      
      if (providers.length === 0) {
        console.log(chalk.red("No API keys configured."));
        process.exit(1);
      }

      providers.forEach(provider => {
        console.log(chalk.green(`\n${provider.name} (${provider.provider}):`));
        console.log(chalk.gray(`  Default: ${provider.defaultModel}`));
        console.log(chalk.white("  Available models:"));
        provider.models.forEach(model => {
          const isDefault = model === provider.defaultModel;
          console.log(chalk.white(`    - ${model}${isDefault ? chalk.gray(" (default)") : ""}`));
        });
      });
      
        console.log(chalk.cyan("\nUsage:"));
        console.log(chalk.white("  quack --provider anthropic --model claude-sonnet-4-5-20250929"));
        console.log(chalk.white("  quack -p openai -m gpt-5.2"));
        console.log(chalk.white("  quack -p grok -m grok-4\n"));
      process.exit(0);
    }

    const title = ChalkAnimation.rainbow("QuackStack\n");
    await new Promise(res => setTimeout(res, 1500));
    title.stop();
    
    if (options.readme) {
      await generateReadme(PROJECT_NAME);
      process.exit(0);
    }

    if (options.context) {
      await generateContextFiles(PROJECT_NAME);
      await updateGlobalContext(PROJECT_NAME);
      process.exit(0);
    }

    if (options.cursor) {
      console.log("--cursor is deprecated. Use --context to support all AI tools.\n");
      console.log("Generating context for AI assistants...\n");
      await generateContextFiles(PROJECT_NAME);
      await updateGlobalContext(PROJECT_NAME);
      console.log("\nContext generation complete!");
      process.exit(0);
    }

    if (options.watch) {
      console.log("Starting watch mode...\n");
      await generateContextFiles(PROJECT_NAME);
      watchAndUpdateContext(PROJECT_NAME);
      await new Promise(() => {});
    }

    await startREPL(options.reindex, options.provider, options.model);
  });

program.parse();