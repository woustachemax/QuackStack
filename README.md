# QuackStack 🐥

**Your cracked unpaid intern for all things codebase related!**

QuackStack is an interactive CLI tool that indexes your codebase using local AI embeddings and lets you ask questions about it conversationally. Perfect for understanding unfamiliar code, onboarding to new projects, or giving your AI coding assistant persistent context.

[Live Demo](https://courageous-spaniel.clueso.site/share/4f5e6395-8ad8-4d18-8e81-f736a6581a25) | [Documentation](https://quackstack.siddharththakkar.xyz/docs) | [Frontend](https://github.com/woustachemax/quack-web)

## Features

* **Zero-config** - Just run `quack` in any project directory
* **Smart code parsing** - Automatically extracts functions and classes
* **Interactive REPL** - Ask questions conversationally, stays open until Ctrl+C
* **100% Local embeddings** - No API calls for vector generation, your code stays private
* **AI-powered answers** - Uses OpenAI, Claude, Gemini, DeepSeek, Grok, or Mistral for conversational responses
* **Git history integration** - Track authorship, commit history, and code ownership
* **Universal AI tool support** - Auto-generate context for Cursor, Windsurf, Cline, Continue, and Aider
* **Local database** - Your code stays on your infrastructure
* **Multi-language** - Supports JS/TS, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, and more

## Installation

### Global Install (Recommended)

```bash
npm install -g quackstack
# or
pnpm add -g quackstack
```

### Local Development

```bash
git clone https://github.com/woustachemax/quackstack.git
cd quackstack
pnpm install
pnpm build
```

## Setup

### 1. Create `.env` in your project root

```bash
# REQUIRED: Database for storing code embeddings
QUACKSTACK_DATABASE_URL=postgresql://user:pass@host:port/dbname

# REQUIRED: Choose ONE AI provider for conversational answers
# (Embeddings are computed locally - no API calls!)

# Option 1: OpenAI
QUACKSTACK_OPENAI_KEY=sk-...

# Option 2: Anthropic Claude
QUACKSTACK_ANTHROPIC_KEY=sk-ant-...

# Option 3: Google Gemini (has free tier!)
QUACKSTACK_GEMINI_KEY=AIza...

# Option 4: xAI Grok
QUACKSTACK_GROK_KEY=xai-...

# Option 5: DeepSeek (cheapest option)
QUACKSTACK_DEEPSEEK_KEY=sk-...

# Option 6: Mistral AI
QUACKSTACK_MISTRAL_KEY=...
```

### 2. Initialize database

```bash
npx prisma generate
npx prisma db push
```

## Usage

### Interactive Mode (Default)

```bash
quack
# Ask questions about your codebase
# Press Ctrl+C to exit
```

### Generate Context for ALL AI Coding Tools

```bash
quack --context

# Creates context files for:
# - Cursor (.cursorrules)
# - Windsurf (.windsurfrules)
# - Cline (.clinerules)
# - Continue (.continue/context.md)
# - Aider (.aider.conf.yml)
```

### Generate AGENTS.md Configuration

```bash
quack --agent

# Creates agent.md with codebase context
# for AI agent frameworks
```

### Generate README

```bash
quack --readme

# Auto-generates README.md from your codebase
```

### Generate Documentation

```bash
quack --docs

# Creates CODEBASE.md with architecture overview
```

### Watch Mode (Auto-update Context)

```bash
quack --watch

# Watches for file changes
# Auto-regenerates context files
```

### Git History Commands

```bash
# View contributor statistics
quack authors

# View recently modified files
quack recent
quack recent --days 30

# View repository information
quack git-info
```

### Force Reindex

```bash
quack --reindex

# Clears old index and re-scans entire codebase
```

### List Available AI Models

```bash
quack --list-models

# Shows all configured providers and available models
```

## Example Session

```bash
$ quack
Welcome to QuackStack!

Using: OpenAI - gpt-4o
Press Ctrl+C to exit

Indexing your codebase...
Indexing complete

quack > how does the search function work?

The search function uses local embeddings to convert your query into a vector,
compares it against stored code embeddings using cosine similarity, ranks results,
and feeds the top matches to the AI for a conversational answer.

Implementation is in src/commands/search.ts

Want more details? (y/n) > n

quack > who wrote the authentication system?

The authentication system was primarily written by Siddharth Thakkar, with the
main implementation in app/api/auth/[...nextauth]/options.ts (last modified 187 days ago).

quack > ^C
Happy coding!
```

## How It Works

1. **Scanning** - Finds all code files (ignoring `node_modules`, `.git`, etc.)
2. **Parsing** - Uses AST parsing to extract functions/classes
3. **Chunking** - Breaks code into logical chunks
4. **Local Embedding** - Generates vector embeddings locally (no API calls)
5. **Git Enrichment** - Extracts commit history, authorship, and ownership data
6. **Storage** - Saves to your PostgreSQL database
7. **Search** - Semantic search using cosine similarity + AI-powered conversational answers

## Commands Reference

| Command | Description |
|---------|-------------|
| `quack` | Start interactive REPL |
| `quack --context` | Generate context files for all AI coding tools |
| `quack --agent` | Generate AGENTS.md configuration |
| `quack --readme` | Generate README.md from codebase |
| `quack --docs` | Generate CODEBASE.md documentation |
| `quack --watch` | Watch mode - auto-update context on file changes |
| `quack --reindex` | Force reindex the entire codebase |
| `quack --list-models` | Show available AI providers and models |
| `quack authors` | View contributor statistics |
| `quack recent [--days N]` | View recently modified files |
| `quack git-info` | View repository information |

## Supported AI Providers

| Provider | Used For | Cost | Privacy | Setup |
|----------|----------|------|---------|-------|
| **Local** | Embeddings | FREE | 100% Private | Built-in |
| OpenAI | Chat answers | $$ | Query only | [Get key](https://platform.openai.com/api-keys) |
| Anthropic | Chat answers | $$$ | Query only | [Get key](https://console.anthropic.com/) |
| Gemini | Chat answers | FREE | Query only | [Get key](https://aistudio.google.com/app/apikey) |
| xAI Grok | Chat answers | $$ | Query only | [Get key](https://x.ai/) |
| DeepSeek | Chat answers | $ | Query only | [Get key](https://platform.deepseek.com/) |
| Mistral | Chat answers | $$ | Query only | [Get key](https://console.mistral.ai/) |

**Privacy Note:** QuackStack generates embeddings locally on your machine. Only your natural language queries and retrieved code context are sent to the AI provider for generating conversational answers. Your entire codebase is never sent to any API.

## Database Schema

```prisma
model codeSnippet {
  id                 Int       @id @default(autoincrement())
  content            String
  embedding          Json
  filePath           String
  projectName        String
  language           String?
  functionName       String?
  lineStart          Int?
  lineEnd            Int?
  
  lastCommitHash     String?
  lastCommitAuthor   String?
  lastCommitEmail    String?
  lastCommitDate     DateTime?
  lastCommitMessage  String?
  totalCommits       Int?       @default(0)
  primaryAuthor      String?
  primaryAuthorEmail String?
  fileOwnerCommits   Int?       @default(0)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectName])
  @@index([lastCommitDate])
  @@index([primaryAuthor])
}

model gitAuthor {
  id             Int       @id @default(autoincrement())
  projectName    String
  author         String
  email          String
  totalCommits   Int       @default(0)
  linesAdded     Int       @default(0)
  linesRemoved   Int       @default(0)
  recentActivity DateTime?
  filesOwned     String[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([projectName, email])
  @@index([projectName])
  @@index([recentActivity])
}
```

## Supported Languages

JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, R, Vue, Svelte

## Use Cases

- **Context switching** - Quickly understand projects you haven't touched in months
- **Onboarding** - New team members can ask questions instead of reading docs
- **Code archaeology** - Find implementations without grepping
- **Code ownership** - Identify who wrote and maintains specific parts of the codebase
- **AI coding assistants** - Give Cursor/Windsurf/Cline/Continue/Aider persistent codebase context
- **Documentation** - Auto-generate explanations of how things work
- **Privacy-focused** - All embeddings generated locally, no code sent to embedding APIs

## Development

```bash
git clone https://github.com/woustachemax/quackstack.git
cd quackstack
pnpm install
pnpm build

# Run locally
node dist/cli.cjs
```

## Contributing

Contributions welcome! Feel free to:
- Report bugs via [GitHub Issues](https://github.com/woustachemax/quackstack/issues)
- Submit feature requests
- Open pull requests

## License

MIT

## Pro Tips

**Privacy First**: Embeddings are generated locally - your code never leaves your machine during indexing.

**Gemini Free Tier**: Start with Google Gemini for chat responses - it's free and works great for most use cases.

**Universal Context**: Run `quack --context` once to generate context files for all major AI coding tools at once.

**Background Watcher**: Run `quack --watch &` in the background to keep context always fresh across all your AI tools.

**Multiple Projects**: Each project gets its own namespace in the database. Just run `quack` in different directories.

**Large Codebases**: First index might take a few minutes. After that, only changed files are re-indexed.

**Git Integration**: QuackStack automatically enriches your codebase with git history - no setup required. Track authorship, view recent changes, and understand code ownership.

**No Vendor Lock-in**: Unlike other tools, QuackStack works with Cursor, Windsurf, Cline, Continue, and Aider - choose your favorite!