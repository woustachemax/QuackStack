#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import { startREPL } from "./repl.js";
import { generateCursorContext, updateCursorGlobalContext, watchAndUpdateCursor } from "./lib/cursor-context.js";
import path from "path";

const program = new Command();
const PROJECT_NAME = path.basename(process.cwd());

program
  .name("quackstack")
  .description("Your cracked unpaid intern for all things codebase!")
  .version("1.0.0")
  .option("-r, --reindex", "Force reindex the codebase")
  .option("-c, --cursor", "Generate .cursorrules file for Cursor AI")
  .option("-w, --watch", "Watch mode: auto-update Cursor context on file changes")
  .action(async (options) => {
    const title = ChalkAnimation.rainbow("Welcome to QuackStack! 🐥\n");
    await new Promise(res => setTimeout(res, 1500));
    title.stop();
    
    if (options.cursor) {
      console.log("🔍 Generating Cursor context...\n");
      await generateCursorContext(PROJECT_NAME);
      await updateCursorGlobalContext(PROJECT_NAME);
      console.log("\n✅ Cursor integration complete!");
      console.log("💡 Cursor will now have context about your codebase");
      process.exit(0);
    }

    if (options.watch) {
      console.log("👀 Starting watch mode for Cursor context...\n");
      await generateCursorContext(PROJECT_NAME);
      watchAndUpdateCursor(PROJECT_NAME);
      await new Promise(() => {});
    }

    await startREPL(options.reindex);
  });

program.parse();