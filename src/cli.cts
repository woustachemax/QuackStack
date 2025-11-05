#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import { startREPL } from "./repl.js";
import { generateContextFiles, updateGlobalContext, watchAndUpdateContext } from "./lib/context-generator.js";
import { generateReadme } from "./commands/readme.js";
import path from "path";

const program = new Command();
const PROJECT_NAME = path.basename(process.cwd());

program
  .name("quackstack")
  .description("Your cracked unpaid intern for all things codebase!")
  .version("1.0.4")
  .option("-r, --reindex", "Force reindex the codebase")
  .option("-c, --context", "Generate context files for ALL AI coding tools (Cursor, Windsurf, Cline, Continue, Aider)")
  .option("-d, --docs", "Generate CODEBASE.md - universal documentation for any IDE/editor")
  .option("--readme", "Generate README.md from your codebase")
  .option("--cursor", "[DEPRECATED] Use --context instead. Generates .cursorrules only")
  .option("-w, --watch", "Watch mode: auto-update context files on file changes")
  .action(async (options) => {
    const title = ChalkAnimation.rainbow("Welcome to QuackStack! 🐥\n");
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
      console.log("⚠️  --cursor is deprecated. Use --context to support all AI tools.\n");
      console.log("🔍 Generating context for AI assistants...\n");
      await generateContextFiles(PROJECT_NAME);
      await updateGlobalContext(PROJECT_NAME);
      console.log("\n✅ Context generation complete!");
      console.log("💡 Your AI coding assistant will now have codebase context");
      process.exit(0);
    }

    if (options.watch) {
      console.log("👀 Starting watch mode...\n");
      await generateContextFiles(PROJECT_NAME);
      watchAndUpdateContext(PROJECT_NAME);
      await new Promise(() => {});
    }

    await startREPL(options.reindex);
  });

program.parse();