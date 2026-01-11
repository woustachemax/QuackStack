#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import chalk from "chalk";
import { startREPL } from "./repl.js";
import { generateContextFiles, updateGlobalContext, watchAndUpdateContext } from "./lib/context-generator.js";
import { generateReadme } from "./commands/readme.js";
import { generateAgentMd } from "./commands/agents.js";
import { getAIClient } from "./lib/ai-provider.js";
import { getProjectAuthors, getRecentlyModifiedFiles } from "./lib/database.js";
import { gitHistory } from "./lib/git-history.js";
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
  .option("--agent", "Generate agent.md configuration file")
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
    
    if (options.agent) {
      await generateAgentMd(PROJECT_NAME);
      process.exit(0);
    }

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

program
  .command("authors")
  .description("Show contributor statistics for this project")
  .action(async () => {
    if (!gitHistory.isRepository()) {
      console.log(chalk.red("❌ Not a git repository"));
      process.exit(1);
    }

    console.log(chalk.cyan("\n📊 Contributor Statistics\n"));
    
    const authors = await getProjectAuthors(PROJECT_NAME);
    
    if (authors.length === 0) {
      console.log(chalk.yellow("No contributor data found. Run 'quack --reindex' first."));
      process.exit(0);
    }

    authors.forEach((author, i) => {
      console.log(chalk.green(`${i + 1}. ${author.author}`) + chalk.gray(` (${author.email})`));
      console.log(chalk.white(`   ${author.totalCommits} commits | +${author.linesAdded}/-${author.linesRemoved} lines`));
      
      if (author.recentActivity) {
        const daysAgo = Math.floor((Date.now() - author.recentActivity.getTime()) / (1000 * 60 * 60 * 24));
        console.log(chalk.gray(`   Last active ${daysAgo} days ago`));
      }
      
      if (author.filesOwned.length > 0) {
        console.log(chalk.gray(`   Owns ${author.filesOwned.length} files`));
      }
      console.log();
    });

    console.log(chalk.cyan(`Total: ${authors.length} contributors\n`));
  });

program
  .command("recent")
  .description("Show recently modified files")
  .option("-d, --days <number>", "Number of days to look back", "7")
  .action(async (options) => {
    if (!gitHistory.isRepository()) {
      console.log(chalk.red("❌ Not a git repository"));
      process.exit(1);
    }

    const days = parseInt(options.days);
    console.log(chalk.cyan(`\n📝 Files modified in last ${days} days\n`));
    
    const files = await getRecentlyModifiedFiles(PROJECT_NAME, days);
    
    if (files.length === 0) {
      console.log(chalk.yellow(`No files modified in last ${days} days (or run 'quack --reindex')`));
      process.exit(0);
    }

    files.forEach((file, i) => {
      const daysAgo = Math.floor((Date.now() - file.lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(chalk.green(`${i + 1}. ${file.filePath}`));
      console.log(chalk.gray(`   Modified by ${file.lastCommitAuthor} ${daysAgo} days ago`));
      if (file.lastCommitMessage) {
        console.log(chalk.white(`   "${file.lastCommitMessage.substring(0, 60)}${file.lastCommitMessage.length > 60 ? '...' : ''}"`));
      }
      console.log();
    });

    console.log(chalk.cyan(`Total: ${files.length} files\n`));
  });

program
  .command("git-info")
  .description("Show git repository information")
  .action(() => {
    if (!gitHistory.isRepository()) {
      console.log(chalk.red("❌ Not a git repository"));
      process.exit(1);
    }

    console.log(chalk.cyan("\n🔍 Git Repository Info\n"));
    
    const branch = gitHistory.getCurrentBranch();
    if (branch) {
      console.log(chalk.white(`Current Branch: `) + chalk.green(branch));
    }
    
    const repoRoot = gitHistory.getRepositoryRoot();
    console.log(chalk.white(`Repository Root: `) + chalk.gray(repoRoot));
    
    console.log(chalk.cyan("\n📈 Recent Commits:\n"));
    const commits = gitHistory.getRecentCommits(10);
    
    commits.slice(0, 5).forEach((commit, i) => {
      const date = new Date(commit.date).toLocaleDateString();
      console.log(chalk.green(`${i + 1}. ${commit.author}`) + chalk.gray(` (${date})`));
      console.log(chalk.white(`   ${commit.message.substring(0, 70)}${commit.message.length > 70 ? '...' : ''}`));
      console.log(chalk.gray(`   ${commit.filesChanged.length} files changed`));
      console.log();
    });
  });

program.parse();