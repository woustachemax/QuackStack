# QuackStack

## Overview
> QuackStack is a local-first code memory system that uses vector embeddings to help developers search through their past projects semantically. Instead of remembering where you wrote something, just ask your duck.

---

## Core Concept

**Problem:** You've written authentication code 5 times across different projects, but can't remember where or how you did it.

**Solution:** 
1. Ingest your old projects once
2. Search semantically: "authentication middleware"
3. Get exact code snippets with file paths instantly

**How it works:**
- Convert code to vector embeddings (numbers representing meaning)
- Store in local SQLite database
- Search by semantic similarity, not keywords

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| **Language** | JavaScript | Faster to build, no build step needed |
| **Database** | SQLite | Local, zero setup, works offline |
| **ORM** | Prisma | Clean API, easy migrations, works with SQLite |
| **Embeddings** | OpenAI API | Best quality, simple, already tested |
| **CLI Framework** | Commander.js | Standard, simple, well-documented |
| **Structure** | Single package | Keep it simple for V1, can split later |

### Why SQLite (Not Postgres)?
- ✅ Zero setup - just a file on disk (`~/.duck/dev.db`)
- ✅ Works offline - no server needed
- ✅ Free - no hosting costs
- ✅ Fast enough for 10,000+ code snippets
- ✅ Easy to migrate to Postgres later if needed

### Why JavaScript (Not TypeScript)?
- ✅ No build configuration needed
- ✅ Easier to debug quickly
- ✅ Can add TypeScript in V2

### Why OpenAI Embeddings (Not Local)?
- ✅ Already tested and working (Task 1 complete)
- ✅ Best quality embeddings available
- ✅ Simple API, well-documented
- ✅ Cost: ~$0.02 per 1000 chunks (very cheap)
- ✅ Local model option can be V2 feature

---

## Project Structure

```
rubber-duck/
├── src/
│   ├── commands/
│   │   ├── ingest.js      # Handles: duck ingest ./project
│   │   ├── search.js      # Handles: duck search "query"
│   │   └── init.js        # Handles: duck init (setup)
│   ├── lib/
│   │   ├── embeddings.js  # OpenAI API wrapper
│   │   ├── database.js    # Prisma operations
│   │   ├── chunker.js     # Code splitting logic
│   │   └── scanner.js     # File discovery
│   └── cli.js             # Main CLI entry (Commander.js)
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Auto-generated
├── examples/              # Test projects to ingest
├── tests/                 # Basic tests
├── .env.example           # Template for API keys
├── .gitignore
├── package.json
└── README.md
```

---

## Database Schema

### CodeSnippet Model (Prisma)

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model CodeSnippet {
  id           String   @id @default(uuid())
  content      String   // The actual code
  embedding    String   // JSON stringified: "[0.023, -0.015, ...]"
  filePath     String   // "./src/auth/login.js"
  projectName  String   // "my-old-api"
  language     String?  // "javascript", "python", "typescript"
  functionName String?  // "authenticate" (if extractable)
  lineStart    Int?     // 45
  lineEnd      Int?     // 67
  createdAt    DateTime @default(now())
  
  @@index([projectName])
}
```

### Field Descriptions

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Unique identifier |
| `content` | Text | The actual code snippet to display |
| `embedding` | Text | Vector as JSON array (1536 dimensions) |
| `filePath` | Text | Relative path from project root |
| `projectName` | Text | To filter searches by project |
| `language` | Text | For syntax highlighting, file icons |
| `functionName` | Text | Better context in search results |
| `lineStart/End` | Int | Show exact location in file |
| `createdAt` | DateTime | For sorting by recency |

### Why Store Embedding as Text?

SQLite doesn't have native vector type. Options:
1. **JSON stringified** (our choice for V1) - Simple, works immediately
2. **sqlite-vss extension** (V2 optimization) - Faster for 10k+ chunks

For V1 with <5000 chunks, JSON + JavaScript cosine similarity is fast enough (<500ms).

---

## Data Flow

### 1. Ingestion Flow

```
User Command: duck ingest ./my-old-project

┌─────────────┐
│   scanner   │ → Find all files recursively
└──────┬──────┘   Filter: .js, .ts, .py, .md
       │          Ignore: node_modules, .git, binaries
       ↓
┌─────────────┐
│   chunker   │ → Split files into semantic chunks
└──────┬──────┘   ~500 lines per chunk
       │          Try to keep functions together
       ↓
┌─────────────┐
│ embeddings  │ → Batch API calls to OpenAI
└──────┬──────┘   text-embedding-3-small model
       │          Process 100 chunks at a time
       ↓
┌─────────────┐
│  database   │ → Store via Prisma
└──────┬──────┘   Insert with all metadata
       │
       ↓
   Display: "✅ Ingested 47 files, 156 chunks in 34s"
```

### 2. Search Flow

```
User Command: duck search "authentication middleware"

┌─────────────┐
│ embeddings  │ → Embed the search query
└──────┬──────┘   Returns 1536-dim vector
       │
       ↓
┌─────────────┐
│  database   │ → Fetch ALL snippets (or filter by project)
└──────┬──────┘   Get content + embeddings
       │
       ↓
┌─────────────┐
│  calculate  │ → Cosine similarity in JavaScript
└──────┬──────┘   Compare query vector to each snippet
       │          Sort by similarity score
       ↓
┌─────────────┐
│   format    │ → Take top 5 results
└──────┬──────┘   Show: file path, code, score, context
       │
       ↓
   Display results with syntax highlighting
```

---

## Core Algorithms

### Cosine Similarity

How we find similar code:

```javascript
function cosineSimilarity(vectorA, vectorB) {
  // Dot product: multiply corresponding elements and sum
  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
  
  // Magnitude: square root of sum of squares
  const magA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
  
  // Similarity: 0 to 1 (1 = identical meaning)
  return dotProduct / (magA * magB);
}
```

**Returns:**
- `1.0` = Identical meaning
- `0.9+` = Very similar (likely what user wants)
- `0.7-0.9` = Somewhat related
- `<0.5` = Different topics

### Chunking Strategy

**Goal:** Split code into searchable pieces without breaking context

**V1 Approach (Simple but Smart):**
1. Split file into ~500 line chunks
2. Try to break on function boundaries (regex for common patterns)
3. Include imports with first chunk
4. Overlap chunks by 50 lines for context

**V2 Approach (AST-based):**
- Parse with Babel/TypeScript parser
- Chunk by function/class boundaries
- Extract metadata (function names, imports)

---

## Performance Targets

| Metric | Target | Why |
|--------|--------|-----|
| **Ingest Speed** | 100 files in <60s | Need to handle medium repos |
| **Search Latency** | <500ms average | Must feel instant |
| **Max Repo Size** | 1000 files | Covers 95% of use cases |
| **Memory Usage** | <100MB | CLI should be lightweight |
| **Disk Space** | ~5MB per 100 files | Embeddings are small |

---

## Edge Cases & Solutions

| Problem | Solution |
|---------|----------|
| **Huge file (10MB+)** | Skip with warning, or chunk more aggressively |
| **Binary files** | Detect by extension/content, skip silently |
| **OpenAI API fails** | Retry with exponential backoff (3 attempts) |
| **Empty folder** | Show friendly message: "No files found" |
| **No API key** | Show setup instructions, link to OpenAI |
| **Database corruption** | Validate on startup, offer to rebuild |
| **Network offline** | Graceful error: "Embeddings require internet" |
| **Search before ingest** | Check DB not empty, suggest `duck ingest` |

---

## CLI Commands

### `duck init`
First-time setup
- Prompt for OpenAI API key
- Create config file at `~/.duckrc`
- Initialize database
- Run migrations

### `duck ingest <path>`
Ingest a folder or repo
```bash
duck ingest ./my-old-project
duck ingest ~/repos/api-v2
```

**Options:**
- `--project-name` - Custom name (defaults to folder name)
- `--extensions` - File types to include (default: js,ts,py,md)

**Output:**
```
🦆 Quack! Ingesting my-old-project...
📂 Found 47 files
✂️  Chunked into 156 pieces
🧠 Generating embeddings... ████████████ 100%
💾 Stored in memory
✨ Done in 34s
```

### `duck search <query>`
Search your memory
```bash
duck search "authentication middleware"
duck search "CSV parsing"
duck search "React hooks"
```

**Options:**
- `--project` - Filter by project name
- `--limit` - Number of results (default: 5)
- `--threshold` - Min similarity score (default: 0.7)

**Output:**
```
🔍 Searching memory...

📄 my-old-project/src/auth/middleware.js (lines 12-34)
   Similarity: 0.93 ████████████████████░

   function authenticate(req, res, next) {
     const token = req.headers.authorization;
     // ... [code snippet]
   }

📄 api-v2/middleware/auth.js (lines 5-28)
   Similarity: 0.87 ████████████████░░░░
   
   [more results...]
```

### `duck list`
Show all ingested projects
```bash
duck list
```

**Output:**
```
📚 Your duck remembers:

my-old-project     47 files, 156 chunks    2 days ago
api-v2            123 files, 487 chunks    1 week ago
personal-site      18 files,  64 chunks    3 weeks ago
```

### `duck forget <project>`
Remove a project from memory
```bash
duck forget my-old-project
```

---

## V1 Scope (This Week)

**Must Have:**
- ✅ Local SQLite storage
- ✅ CLI with ingest + search
- ✅ OpenAI embeddings
- ✅ Support JS/TS/PY files
- ✅ Beautiful terminal output
- ✅ Basic error handling

**Out of Scope:**
- ❌ Web UI
- ❌ Cloud sync
- ❌ Team features
- ❌ GitHub integration
- ❌ Local embedding model
- ❌ Advanced AST parsing

---

## V2 Ideas (Future)

1. **Cloud Sync** - Optional backup to remote DB
2. **Web UI** - Browser interface for search
3. **Team Mode** - Share memory across team
4. **GitHub Integration** - Auto-ingest on push
5. **Local Embeddings** - Offline mode with transformers.js
6. **IDE Plugins** - VSCode/Cursor extension
7. **Smart Ranking** - Weight by recency, language, project
8. **Snippet Editing** - Update stored code without re-ingesting

---

## Development Timeline

### Wednesday (Tonight)
- [x] Learn embeddings (Task 1 complete)
- [x] Review this architecture
- [x] Prepare development environment

### Thursday (3 hours)
- Setup project structure
- Build database layer (Prisma)
- Build embeddings wrapper
- Build scanner + chunker

### Friday (3 hours)
- Build CLI commands (ingest + search)
- Add progress indicators
- Format output beautifully

### Saturday (4 hours)
- Handle edge cases
- Add remaining commands (list, forget)
- Polish UX
- Basic testing

### Sunday (Landing Page)
- Create siddharththakkar.xyz/duck
- Record demo video
- Write documentation

---

## Success Metrics

**Week 1:**
- ✅ Tool works end-to-end
- ✅ Published to npm
- ✅ Can ingest 100-file repo in <60s
- ✅ Search returns in <500ms

**Week 2:**
- 10+ people try it
- 3+ people give feedback
- First GitHub star

**Month 1:**
- 50+ npm installs
- Someone asks about paid features
- Listed on one "awesome" list

---

## Security & Privacy

**V1 Approach:**
- All data stored locally on user's machine
- API keys stored in `~/.duckrc` (plaintext - document this)
- Only OpenAI sees code snippets (for embedding)
- No telemetry, no tracking

**Future Considerations:**
- Encrypt API keys in config file
- Option to use local embeddings (fully private)
- Clear data usage policy

---

## Questions & Decisions Log

**Q: Why not use sqlite-vss from the start?**  
A: Adds complexity. JSON + JS cosine similarity is fast enough for V1 (<5000 chunks). Can optimize later if needed.

**Q: Why not support all languages?**  
A: Focus on what we know works (JS/TS/PY). Easy to add more later.

**Q: Why not build API from the start?**  
A: CLI proves the concept. API can be added in week 2 without rewriting core logic.

**Q: Why OpenAI instead of free local model?**  
A: Quality matters more than cost for V1. Local model can be optional in V2.

---

## Useful Resources

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Prisma Docs](https://www.prisma.io/docs)
- [Commander.js](https://github.com/tj/commander.js)
- [Cosine Similarity Explained](https://en.wikipedia.org/wiki/Cosine_similarity)

---

**Author:** [Siddharth Thakkar](https://www.siddharththakkar.xyz/)
