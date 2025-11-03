#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import { startREPL } from "./repl.js";

const program = new Command();

program
  .name("quackstack")
  .description("Your cracked unpaid intern for all things codebase!")
  .version("1.0.0")
  .option("-r, --reindex", "Force reindex the codebase")
  .action(async (options) => {
    const title = ChalkAnimation.rainbow("Welcome to QuackStack! 🐥\n");
    await new Promise(res => setTimeout(res, 1500));
    title.stop();
    
    await startREPL(options.reindex);
  });

program.parse();