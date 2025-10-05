#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import { ingest } from "./commands/ingest.js";
import { search } from "./commands/search.js";

const program = new Command();

program
  .name("quackstack")
  .description("Your cracked unpaid intern for all things codebase!")
  .version("1.0.0")
  .option("-i, --ingest <dir>", "Ingest the codebase")
  .option("-q, --query <question>", "Ask a question about the codebase")
  .parse(process.argv);

const options = program.opts();

async function main() {
  const title = ChalkAnimation.rainbow("Welcome to QuackStack! 🐥 \n");
  await new Promise(res => setTimeout(res, 1500));
  title.stop();

  if (options.ingest) {
    await ingest(options.ingest);
  }

  if (options.query) {
    const results = await search(options.query);
    console.log("Top results:\n");
    results.forEach(r => console.log(`${r.filePath} (score: ${r.score.toFixed(2)})\n${r.content}\n---`));
  }
}

main();
