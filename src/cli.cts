#!/usr/bin/env node

import { Command } from "commander";
import ChalkAnimation from "chalk-animation";
import chalk from "chalk";
import { startREPL } from "./repl.js";
import { generateContextFiles, updateGlobalContext, watchAndUpdateContext } from "./lib/context-generator.js";
import { generateReadme } from "./commands/readme.js";
import { generateAgentMd } from "./commands/agents.js";
import { getAIClient } from "./lib/ai-provider.js";
import { getProjectAuthors, getRecentlyModifiedFiles, getProjectCommits, getCommitByHash, getFunctionAtLine } from "./lib/database.js";
import { gitHistory } from "./lib/git-history.js";
import { classifyCommit, AgentConfidence } from "./lib/agent-attribution.js";
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

const CONFIDENCE_COLOR: Record<AgentConfidence, (s: string) => string> = {
  high: chalk.green,
  medium: chalk.yellow,
  low: chalk.gray,
  human: chalk.gray,
};

function shortHash(hash: string): string {
  return hash.substring(0, 7);
}

program
  .command("authors")
  .description("Show contributor statistics for this project")
  .option("--agents", "Split ownership by human vs agent (Claude Code, Cursor, ...)")
  .action(async (options) => {
    if (!gitHistory.isRepository()) {
      console.log(chalk.red("❌ Not a git repository"));
      process.exit(1);
    }

    if (options.agents) {
      await showAgentAuthors();
      process.exit(0);
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

program
  .command("blame <target>")
  .description("Resolve <file>:<line> to the commit, author, and agent that last changed it")
  .action(async (target: string) => {
    if (!gitHistory.isRepository()) {
      console.log(chalk.red("❌ Not a git repository"));
      process.exit(1);
    }

    const idx = target.lastIndexOf(":");
    if (idx === -1) {
      console.log(chalk.red("Usage: quack blame <file>:<line>   e.g. quack blame src/lib/ai-provider.ts:130"));
      process.exit(1);
    }

    const filePart = target.substring(0, idx);
    const line = parseInt(target.substring(idx + 1));
    if (!Number.isFinite(line) || line < 1) {
      console.log(chalk.red(`Invalid line number: "${target.substring(idx + 1)}"`));
      process.exit(1);
    }

    const repoRoot = gitHistory.getRepositoryRoot();
    const absPath = path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart);
    const relPath = path.relative(repoRoot, absPath);

    const blame = gitHistory.getBlameForLine(relPath, line);
    if (!blame) {
      console.log(chalk.red(`Could not blame ${relPath}:${line} (file not tracked, or line out of range)`));
      process.exit(1);
    }

    const stored = await getCommitByHash(blame.hash).catch(() => null);
    let agentName: string | null;
    let confidence: AgentConfidence;
    let sessionId: string | null;

    if (stored) {
      agentName = stored.agentName;
      confidence = stored.agentConfidence as AgentConfidence;
      sessionId = stored.sessionId;
    } else {
      const msg = gitHistory.getCommitMessage(blame.hash) || blame.summary;
      const attr = classifyCommit(msg);
      agentName = attr.agentName;
      confidence = attr.confidence;
      sessionId = attr.sessionId;
      console.log(chalk.gray("(commit not indexed — run 'quack --reindex' for cadence-based signals)"));
    }

    const fn = await getFunctionAtLine(PROJECT_NAME, absPath, line).catch(() => null);
    const inFn = fn?.functionName ? chalk.gray(`   (in ${fn.functionName})`) : "";

    const agentLine =
      confidence === "human" || !agentName
        ? chalk.gray(confidence === "low" ? "suspected agent (unattributed)" : "human")
        : CONFIDENCE_COLOR[confidence](`${agentName}`);

    console.log();
    console.log(chalk.white(`${relPath}:${line}`) + inFn);
    console.log();
    console.log(chalk.white("commit  ") + chalk.yellow(shortHash(blame.hash)) + chalk.gray(`  ${blame.summary}`));
    console.log(chalk.white("author  ") + `${blame.author} <${blame.email}>`);
    console.log(chalk.white("date    ") + chalk.gray(blame.authoredAt.toISOString().split("T")[0]));
    console.log(chalk.white("agent   ") + agentLine + chalk.gray(`   confidence: ${confidence}`));
    console.log(chalk.white("session ") + (sessionId ? chalk.cyan(sessionId) : chalk.gray("—")));
    console.log();
  });

async function showAgentAuthors() {
  console.log(chalk.cyan("\n🤖 Agent vs Human Ownership\n"));

  const commits = await getProjectCommits(PROJECT_NAME);
  if (commits.length === 0) {
    console.log(chalk.yellow("No commit data found. Run 'quack --reindex' first."));
    return;
  }

  interface Bucket {
    label: string;
    commits: number;
    files: Set<string>;
    first: Date;
    last: Date;
    conf: Record<AgentConfidence, number>;
  }

  const buckets = new Map<string, Bucket>();

  const bucketKey = (agentName: string | null, confidence: AgentConfidence): string => {
    if (confidence === "human") return "Humans";
    if (!agentName) return "Suspected (unattributed)";
    return agentName;
  };

  for (const c of commits) {
    const conf = c.agentConfidence as AgentConfidence;
    const key = bucketKey(c.agentName, conf);
    let b = buckets.get(key);
    if (!b) {
      b = { label: key, commits: 0, files: new Set(), first: c.authoredAt, last: c.authoredAt, conf: { high: 0, medium: 0, low: 0, human: 0 } };
      buckets.set(key, b);
    }
    b.commits++;
    b.conf[conf]++;
    if (c.authoredAt < b.first) b.first = c.authoredAt;
    if (c.authoredAt > b.last) b.last = c.authoredAt;
    for (const f of c.files) b.files.add(f.filePath);
  }

  const ordered = Array.from(buckets.values()).sort((a, b) => {
    if (a.label === "Humans") return 1;
    if (b.label === "Humans") return -1;
    return b.commits - a.commits;
  });

  for (const b of ordered) {
    const isAgent = b.label !== "Humans";
    const header = isAgent ? chalk.green(b.label) : chalk.white(b.label);
    console.log(header + chalk.gray(`  —  ${b.commits} commit${b.commits === 1 ? "" : "s"}, ${b.files.size} file${b.files.size === 1 ? "" : "s"} touched`));
    const span = `${b.first.toISOString().split("T")[0]} → ${b.last.toISOString().split("T")[0]}`;
    console.log(chalk.gray(`   active ${span}`));
    if (isAgent) {
      console.log(chalk.gray(`   confidence: high ${b.conf.high} / medium ${b.conf.medium} / low ${b.conf.low}`));
    }
    console.log();
  }

  const total = commits.length;
  const agentCommits = commits.filter((c) => c.agentConfidence !== "human").length;
  const pct = total > 0 ? Math.round((agentCommits / total) * 100) : 0;
  console.log(chalk.cyan(`${agentCommits}/${total} commits (${pct}%) attributed to agents\n`));
}

program.parse();