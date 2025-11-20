# QuackStack 🐥

**Your cracked unpaid intern for all things codebase related!**

QuackStack is an interactive CLI tool that indexes your codebase using local AI embeddings and lets you ask questions about it conversationally. Perfect for understanding unfamiliar code, onboarding to new projects, or giving your AI coding assistant persistent context.

## 🎯 Quack in Action!
Check out the QuackStack Live demo [here](https://courageous-spaniel.clueso.site/share/4f5e6395-8ad8-4d18-8e81-f736a6581a25)!
## ✨ Features

* 🚀 **Zero-config** - Just run `quack` in any project directory
* 🧠 **Smart code parsing** - Automatically extracts functions and classes
* 💬 **Interactive REPL** - Ask questions conversationally, stays open until Ctrl+C
* 🔒 **100% Local embeddings** - No API calls for vector generation, your code stays private
* 🤖 **AI-powered answers** - Uses OpenAI, Claude, Gemini, DeepSeek, or Mistral for conversational responses
* 🎯 **Universal AI tool support** - Auto-generate context for Cursor, Windsurf, Cline, Continue, and Aider
* 📦 **Local database** - Your code stays on your infrastructure
* 🌍 **Multi-language** - Supports JS/TS, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, and more


## 💻 Frontend
Check out the Frontend Repo [here](https://github.com/woustachemax/quack-web)
## 📦 Installation

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

## ⚙️ Setup

### 1. Create `.env` in your project root

```bash
# REQUIRED: Database for storing code embeddings
QUACKSTACK_DATABASE_URL=postgresql://user:pass@host:port/dbname

# REQUIRED: Choose ONE AI provider for conversational answers
# (Embeddings are computed locally - no API calls!)

# Option 1: OpenAI (RECOMMENDED)
QUACKSTACK_OPENAI_KEY=sk-...

# Option 2: Anthropic Claude
QUACKSTACK_ANTHROPIC_KEY=sk-ant-...

# Option 3: Google Gemini (has free tier!)
QUACKSTACK_GEMINI_KEY=AIza...

# Option 4: DeepSeek (cheapest option)
QUACKSTACK_DEEPSEEK_KEY=sk-...

# Option 5: Mistral AI
QUACKSTACK_MISTRAL_KEY=...
```

### 2. Initialize database

```bash
npx prisma generate
npx prisma db push
```

## 🚀 Usage

### Interactive Mode (Default)

```bash
quack

# Answer appears with context
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

# Your AI coding assistants automatically read these files!
```

### Watch Mode (Auto-update Context)

```bash
quack --watch

# Watches for file changes
# Auto-regenerates all context files
# Keep running in background during development
```

### Force Reindex

```bash
quack --reindex

# Clears old index and re-scans entire codebase
```

## 📖 Example Session

```bash
$ quack
Welcome to QuackStack! 🐥
🔍 Indexing your codebase (this may take a moment)...
✅ Indexing complete!

💡 Tip: Press Ctrl+C to exit

🐥 Quack! How can I help? > how does the search function work?

The search function uses local embeddings to convert your query into a vector,
compares it against stored code embeddings using cosine similarity, ranks results,
and feeds the top matches to the AI for a conversational answer.

Implementation is in src/commands/search.ts

💡 Want more details? (y/n) > y

📚 Relevant Code:

[1] src/commands/search.ts (relevance: 87.3%)
export async function search(query: string, projectName: string) {
  const snippets = await client.codeSnippet.findMany({
    where: { projectName },
  });
  // ... cosine similarity ranking ...
}

🐥 Quack! How can I help? > where are embeddings generated?

Embeddings are generated locally using the local-embeddings module.
No API calls are made for vector generation, keeping your code private.

💡 Want more details? (y/n) > n

🐥 Quack! How can I help? > ^C
👋 Happy coding!
```

## 🛠️ How It Works

1. **Scanning** - Finds all code files (ignoring `node_modules`, `.git`, etc.)
2. **Parsing** - Uses AST parsing to extract functions/classes from JS/TS
3. **Chunking** - Breaks code into logical chunks
4. **Local Embedding** - Generates vector embeddings **locally** (no API calls!)
5. **Storage** - Saves to your PostgreSQL/Neon database
6. **Search** - Semantic search using cosine similarity + AI-powered conversational answers

## 🎯 Use Cases

- **Context switching** - Quickly understand projects you haven't touched in months
- **Onboarding** - New team members can ask questions instead of reading docs
- **Code archaeology** - Find implementations without grepping
- **AI coding assistants** - Give Cursor/Windsurf/Cline/Continue/Aider persistent codebase context
- **Documentation** - Auto-generate explanations of how things work
- **Privacy-focused** - All embeddings generated locally, no code sent to embedding APIs

## 📋 Commands Reference

| Command | Description |
|---------|-------------|
| `quack` | Start interactive REPL (auto-indexes first time) |
| `quack --context` | Generate context files for ALL AI coding tools |
| `quack --watch` | Watch mode - auto-update context on file changes |
| `quack --reindex` | Force reindex the entire codebase |
| `quack --cursor` | [DEPRECATED] Use `--context` instead |

## 🔑 Supported AI Providers

| Provider | Used For | Cost | Privacy | Setup |
|----------|----------|------|---------|-------|
| **Local** | Embeddings | FREE | 🔒 100% Private | Built-in |
| OpenAI | Chat answers | $$ | Query only | [Get key](https://platform.openai.com/api-keys) |
| Anthropic | Chat answers | $$$ | Query only | [Get key](https://console.anthropic.com/) |
| Gemini | Chat answers | FREE | Query only | [Get key](https://aistudio.google.com/app/apikey) |
| DeepSeek | Chat answers | $ | Query only | [Get key](https://platform.deepseek.com/) |
| Mistral | Chat answers | $$ | Query only | [Get key](https://console.mistral.ai/) |

**Privacy Note:** QuackStack generates embeddings **locally** on your machine. Only your natural language queries and retrieved code context are sent to the AI provider for generating conversational answers. Your entire codebase is never sent to any API.

## 🗄️ Database Schema

```prisma
model codeSnippet {
  id           Int      @id @default(autoincrement())
  content      String
  embedding    Json     // Stored as JSON array of numbers
  filePath     String
  projectName  String
  language     String?
  functionName String?
  lineStart    Int?
  lineEnd      Int?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([projectName])
}
```

Each project is isolated by `projectName` (uses current directory name).

## 🌍 Supported Languages

JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, R, Vue, Svelte

## 🎓 Development

```bash
git clone https://github.com/woustachemax/quackstack.git
cd quackstack
pnpm install

pnpm build

# Run locally
node dist/cli.cjs
node dist/cli.cjs --context
node dist/cli.cjs --watch
```

## 🗺️ Roadmap

- [x] Local embeddings (no API calls!)
- [x] Support for all major AI coding assistants
- [ ] VS Code extension
- [ ] Official Cursor plugin
- [ ] Export Q&A sessions as markdown docs
- [ ] Add filtering by file type, date range, author
- [ ] Support for code diffs and change tracking
- [ ] Team collaboration features
- [ ] Self-hosted web UI

## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs via [GitHub Issues](https://github.com/woustachemax/quackstack/issues)
- Submit feature requests
- Open pull requests

## 📄 License

MIT

## 💡 Pro Tips

**Privacy First**: Embeddings are generated locally - your code never leaves your machine during indexing.

**Gemini Free Tier**: Start with Google Gemini for chat responses - it's free and works great for most use cases.

**Universal Context**: Run `quack --context` once to generate context files for ALL major AI coding tools at once.

**Background Watcher**: Run `quack --watch &` in the background to keep context always fresh across all your AI tools.

**Multiple Projects**: Each project gets its own namespace in the database. Just run `quack` in different directories.

**Large Codebases**: First index might take a few minutes. After that, only changed files are re-indexed.

**No Vendor Lock-in**: Unlike other tools, QuackStack works with Cursor, Windsurf, Cline, Continue, and Aider - choose your favorite!
