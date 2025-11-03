# QuackStack 🐥

**Your cracked unpaid intern for all things codebase related!**

QuackStack is an interactive CLI tool that indexes your codebase using AI embeddings and lets you ask questions about it conversationally. Perfect for understanding unfamiliar code, onboarding to new projects, or giving your AI coding assistant persistent context.


## ✨ Features

* 🚀 **Zero-config** - Just run `quack` in any project directory
* 🧠 **Smart code parsing** - Automatically extracts functions and classes
* 💬 **Interactive REPL** - Ask questions conversationally, stays open until Ctrl+C
* 🤖 **Multi-AI support** - Works with OpenAI, Claude, Gemini, DeepSeek, or Mistral
* 🎯 **Cursor integration** - Auto-generate `.cursorrules` for Cursor AI
* 📦 **Local database** - Your code stays on your infrastructure
* 🌍 **Multi-language** - Supports JS/TS, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, and more


## 📦 Installation

### Global Install (Recommended)

```bash
pnpm add -g quackstack

npm install -g quackstack
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
# REQUIRED!
QUACKSTACK_DATABASE_URL=postgresql://user:pass@host:port/dbname

# Choose ONE AI provider:

# Option 1: OpenAI (RECOOMMENDED!)
QUACKSTACK_OPENAI_KEY=sk-...

# Option 2: Anthropic Claude
QUACKSTACK_ANTHROPIC_KEY=sk-ant-...

# Option 3: Google Gemini (has free tier!)
QUACKSTACK_GEMINI_KEY=AIza...

# Option 4: DeepSeek (cheapest option)
QUACKSTACK_DEEPSEEK_KEY=sk-...

# Option 5: Mistral AI
QUACKSTACK_MISTRAL_KEY=...

# NOTE: If using Claude/Gemini/Mistral, you still NEED OpenAI for embeddings:
QUACKSTACK_EMBEDDING_KEY=sk-...
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


🐥 Quack! How can I help? > where is authentication handled?

# Answer appears with context
# Press Ctrl+C to exit
```

### Generate Cursor Context

```bash
quack --cursor

# Creates .cursorrules file with:
# - Architecture overview
# - Main entry points
# - Key functions and files
# - Project structure

# Cursor AI automatically reads this file!
```

### Watch Mode (Auto-update Cursor)

```bash
quack --watch

# Watches for file changes
# Auto-regenerates .cursorrules
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

The search function converts your query to embeddings, compares them
against stored code embeddings using cosine similarity, ranks results,
and feeds the top matches to the AI for a conversational answer.

Implementation is in src/commands/search.ts

💡 Want more details? (y/n) > y

📚 Relevant Code:

[1] src/commands/search.ts (relevance: 87.3%)
export async function search(query: string, projectName: string) {
  const queryEmbedding = await aiClient.getEmbeddings(query);
  const snippets = await client.codeSnippet.findMany({
    where: { projectName },
  });
  // ... cosine similarity ranking ...
}


🐥 Quack! How can I help? > where are embeddings generated?

Vector embeddings are generated in src/lib/ai-provider.ts using
the getEmbeddings() method with OpenAI's text-embedding-3-large model.

💡 Want more details? (y/n) > n

🐥 Quack! How can I help? > ^C
👋 Happy coding!
```


## 🛠️ How It Works

1. **Scanning** - Finds all code files (ignoring `node_modules`, `.git`, etc.)
2. **Parsing** - Uses AST parsing to extract functions/classes from JS/TS
3. **Chunking** - Breaks other languages into logical chunks
4. **Embedding** - Generates vector embeddings for each code chunk
5. **Storage** - Saves to your PostgreSQL/Neon database
6. **Search** - Semantic search + AI-powered conversational answers


## 🎯 Use Cases

- **Context switching** - Quickly understand projects you haven't touched in months
- **Onboarding** - New team members can ask questions instead of reading docs
- **Code archaeology** - Find implementations without grepping
- **AI coding assistants** - Give Cursor/Claude/ChatGPT persistent codebase context
- **Documentation** - Auto-generate explanations of how things work


## 📋 Commands Reference

| Command | Description |
|---------|-------------|
| `quack` | Start interactive REPL (auto-indexes first time) |
| `quack --cursor` | Generate `.cursorrules` for Cursor AI |
| `quack --watch` | Watch mode - auto-update Cursor context on file changes |
| `quack --reindex` | Force reindex the entire codebase |


## 🔑 Supported AI Providers

| Provider | Chat | Embeddings | Cost | Setup |
|----------|------|------------|------|-------|
| OpenAI | ✅ GPT-4o-mini | ✅ | $$ | [Get key](https://platform.openai.com/api-keys) |
| Anthropic | ✅ Claude 3.5 | ❌ | $$$ | [Get key](https://console.anthropic.com/) |
| Gemini | ✅ Gemini 1.5 | ❌ | FREE | [Get key](https://aistudio.google.com/app/apikey) |
| DeepSeek | ✅ | ✅ | $ | [Get key](https://platform.deepseek.com/) |
| Mistral | ✅ | ❌ | $$ | [Get key](https://console.mistral.ai/) |

**Note:** If you use Claude, Gemini, or Mistral for chat, you still need an OpenAI or DeepSeek key for embeddings.


## 🗄️ Database Schema

```prisma
model codeSnippet {
  id           Int      @id @default(autoincrement())
  content      String
  embedding    Json
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

node dist/cli.cjs

node dist/cli.cjs --cursor
node dist/cli.cjs --watch
```


## 🗺️ Roadmap

- [ ] Support more embedding providers (Cohere, Voyage AI)
- [ ] Add filtering by file type, date range, author
- [ ] Generate automatic codebase documentation
- [ ] Export Q&A sessions as markdown docs
- [ ] VS Code extension
- [ ] Official Cursor plugin
- [ ] Support for code diffs and change tracking
- [ ] Team collaboration features


## 🤝 Contributing

Contributions welcome! Feel free to:
- Report bugs via [GitHub Issues](https://github.com/woustachemax/quackstack/issues)
- Submit feature requests
- Open pull requests


## 📄 License

MIT


## 💡 Pro Tips

**Gemini Free Tier**: Start with Google Gemini - it's free and works great for most use cases.

**DeepSeek for Production**: If you need cheap embeddings at scale, use DeepSeek (~$0.14 per million tokens).

**Cursor Integration**: Run `quack --cursor` once, then `quack --watch &` in the background to keep context always fresh.

**Multiple Projects**: Each project gets its own namespace in the database. Just run `quack` in different directories.

**Large Codebases**: First index might take a few minutes. After that, only changed files are re-indexed.