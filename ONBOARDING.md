Onboarding — QuackStack
=======================

This is a developer onboarding guide for QuackStack: how to build, run, and extend it. It assumes you're comfortable with TypeScript/JavaScript and PostgreSQL.

Table of contents
-----------------
- Quick TL;DR
- Assumptions
- Quick Setup & Run (copy/paste)
- Project structure (top-level)
- What every important file does (deep dive)
- How the main flow works (ingest → embeddings → DB → search → AI)
- Environment variables and API keys
- Database & Prisma: schema, migrations, generate
- Key code snippets and small walkthrough examples
- Common tasks (indexing, reindexing, switching models)
- Debugging & troubleshooting tips
- Adding a new AI provider or model
- Suggested first PRs or exploration tasks
- Appendix: useful commands and references

Quick TL;DR
-----------

- QuackStack is a CLI tool that indexes your codebase into chunks, computes local embeddings, stores snippets + metadata in Postgres, and answers questions via an AI provider.
- If you know Node.js (TypeScript) and PostgreSQL, follow the Quick Setup & Run section below and you'll have it running locally.

Assumptions
-----------

- You're on Linux (bash), Node.js >= 20 (project requires >=20), pnpm or npm is available.
- You have a PostgreSQL instance accessible and credentials for it.
- You know how to set environment variables and run terminal commands.

Quick Setup & Run (copy/paste)
------------------------------

1) Clone the repo and install deps

```bash
git clone https://github.com/woustachemax/quackstack.git
cd quackstack
pnpm install
```

2) Create a `.env` file in the project root (example below)

```bash
cat > .env <<'EOF'
QUACKSTACK_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quackstack
# Provide one of these API keys if you want conversational answers from a hosted provider
# QUACKSTACK_OPENAI_KEY=sk-...
# QUACKSTACK_ANTHROPIC_KEY=...
# QUACKSTACK_GEMINI_KEY=...
# QUACKSTACK_DEEPSEEK_KEY=...
# QUACKSTACK_MISTRAL_KEY=...
# QUACKSTACK_GROK_KEY=...
# QUACKSTACK_PRIMEINTELLECT_KEY=...
EOF
```

3) Generate Prisma client and push schema

```bash
npx prisma generate
npx prisma db push
```

4) Build TypeScript

```bash
pnpm build
# or: npx tsc
```

5) Run CLI and index your current project

```bash
# Start the REPL for the project in the current directory
node dist/cli.cjs

# Or to force a reindex, run:
node dist/cli.cjs --reindex

# Generate context files for AI coding tools
node dist/cli.cjs --context
```

Project structure (top-level)
-----------------------------

Files and directories you will work with most:

- `src/` - TypeScript source
  - `cli.cts` - program entry point, command parsing
  - `repl.ts` - interactive CLI loop and UI
  - `commands/` - CLI command handlers
    - `ingest.ts` - indexing pipeline
    - `search.ts` - search + answer orchestration
    - `agents.ts` - AGENTS.md generator
    - `readme.ts` - README generator
  - `lib/` - core library pieces
    - `ai-provider.ts` - multi-provider AI wrapper
    - `chunker.ts` - code chunking logic
    - `scanner.ts` - file discovery
    - `local-embeddings.ts` - local TF-IDF embeddings
    - `git-history.ts` - git enrichment utilities
    - `database.ts` - Prisma wrapper methods
    - `context-generator.ts` - generates files for external assistants
    - `file-change-detector.ts` - detects changes for watch/reindex
    - `session-generator.ts` - session management (lightweight)
- `prisma/` - Prisma schema & migrations
- `README.md` - public docs (long-form)
- `ONBOARDING.md` - this file

What every important file does (deep dive)
-------------------------------------------

Below is a focused explanation of the most critical files, each with a code snippet illustrating the core behavior.

1) `src/cli.cts`

- Role: Primary entry point and command routing using `commander`.
- Important behavior:
  - Parses CLI flags (`--reindex`, `--context`, `--list-models`, etc.)
  - Calls `startREPL()` from `src/repl.ts` for interactive usage
  - Provides `authors`, `recent`, and `git-info` subcommands that talk to `lib/git-history.ts` and `lib/database.ts`.

Snippet (how `--context` is handled):

```ts
if (options.context) {
  await generateContextFiles(PROJECT_NAME);
  await updateGlobalContext(PROJECT_NAME);
  process.exit(0);
}
```

2) `src/repl.ts`

- Role: Interactive REPL UI, welcome screen, and main loop.
- Important behavior:
  - Shows the ASCII welcome screen (`displayGrandiosWelcome()`)
  - Calls `getAIClient()` to select an AI provider
  - Checks DB for existing index; if missing or forced, calls `ingest()`
  - Reads user lines, passes queries to `search()` and displays results

Snippet (starting & indexing):

```ts
const existingCount = await client.codeSnippet.count({ where: { projectName: PROJECT_NAME } });
if (existingCount === 0 || forceReindex) {
  await ingest(process.cwd(), PROJECT_NAME, false);
}
```

3) `src/commands/ingest.ts`

- Role: Pipeline that finds files, chunks code, computes local embeddings, enriches with git history, and saves to DB.
- Steps it performs:
  1. `initGitHistory(rootDir)` — sets repo root
  2. `scanDir(rootDir)` — collects files to index
  3. `chunkCode(content)` — split code into meaningful chunks
  4. `localEmbeddings.addDocuments(allContent)` + `localEmbeddings.getVector(content)` — compute TF-IDF vectors
  5. Batch `saveToDB()` calls that insert code snippets and git metadata
  6. Compute author stats via `gitHistory.getAuthorStats()` and upsert via `saveAuthorToDB()`

Important snippet (saving a chunk):

```ts
const embedding = localEmbeddings.getVector(content);
await saveToDB({
  content,
  embedding,
  filePath,
  projectName,
  language: path.extname(filePath),
  functionName: chunk.functionName,
  lineStart: chunk.lineStart,
  lineEnd: chunk.lineEnd,
  ...gitMetadata,
});
```

4) `src/lib/local-embeddings.ts`

- Role: Provide local embeddings via TF-IDF. This ensures privacy and no external embedding calls.
- Important API:
  - `addDocuments(docs: string[])` — builds IDF map across docs
  - `getVector(text: string)` — compute TF-IDF vector for `text`
  - `cosineSimilarity(a,b)` — similarity between vectors

Snippet (vector generation):

```ts
const tokens = this.tokenize(text);
const tf = this.computeTF(tokens);
const allTerms = Array.from(this.idf.keys());
const vector = allTerms.map(term => (tf.get(term) || 0) * (this.idf.get(term) || 0));
```

5) `src/lib/git-history.ts`

- Role: Run git commands (`git log`, `git blame`, `git shortlog`) to build file histories and author stats.
- Important APIs:
  - `getFileHistory(filePath, limit)` — returns commits and primary authors for a file
  - `getAuthorStats()` — returns aggregate commit counts, line additions/removals, last activity
  - `getRecentCommits()` / `getRecentlyChangedFiles(days)`

Key note: `initGitHistory(projectPath)` re-initializes the `gitHistory` singleton so the rest of the code uses the correct repo root.

6) `src/lib/ai-provider.ts`

- Role: Abstracts multiple AI providers (OpenAI, Anthropic, Gemini, DeepSeek, Mistral, Grok, Prime Intellect) and exposes a uniform interface.
- Important API:
  - `getAIClient(provider?, model?)` — returns a singleton AI client
  - `aiClient.generateAnswer(prompt, context)` — returns a conversational answer
  - `getAvailableProviders()` — lists configured providers and models

Important excerpt (how providers are discovered):

```ts
if (process.env.QUACKSTACK_OPENAI_KEY) {
  providers.push({ provider: 'openai', name: 'OpenAI', models: [...], defaultModel: 'gpt-5.6-terra' });
}
```

7) `src/lib/database.ts`

- Role: Prisma client wrapper for storing/retrieving `codeSnippet` and `gitAuthor` rows.
- Important functions:
  - `saveToDB(data)` — inserts a `codeSnippet`
  - `saveAuthorToDB(data)` — upserts `gitAuthor`
  - `getProjectAuthors(projectName)` — used by CLI `authors`
  - `getRecentlyModifiedFiles(projectName, days)` — used by CLI `recent`

DB model (Prisma schema summary):

```prisma
model codeSnippet {
  id Int @id @default(autoincrement())
  content String
  embedding Json
  filePath String
  projectName String
  lastCommitAuthor String?
  totalCommits Int? @default(0)
  primaryAuthor String?
  createdAt DateTime @default(now())
}

model gitAuthor {
  id Int @id @default(autoincrement())
  projectName String
  author String
  email String
  totalCommits Int @default(0)
  filesOwned String[]
}
```

How the main flow works (high-level)
------------------------------------

1) User runs `quack` in a project directory.
2) `repl.ts` calls into the DB to check for indexed snippets.
3) If missing or forced, `ingest()` indexes the project:
   - `scanner.ts` finds files
   - `chunker.ts` splits code into chunks, preserving functions/classes
   - `local-embeddings.ts` computes TF-IDF vectors
   - `git-history.ts` enriches with commit metadata
   - `database.ts` stores snippets and author stats
4) User enters a query in the REPL.
5) `search.ts` computes a vector for the query using the same `local-embeddings` (IDF must be re-computed with `addDocuments`), scores snippets by cosine similarity, applies boosting, picks top results and builds `context`.
6) `search.ts` calls `aiClient.generateAnswer(prompt, context)` to produce a conversational answer and shows sources on request.

Environment variables and API keys
---------------------------------

Minimum required:
- `QUACKSTACK_DATABASE_URL` — Postgres connection string

Optional (pick one if you want external conversational models):
- `QUACKSTACK_OPENAI_KEY` — OpenAI API key
- `QUACKSTACK_ANTHROPIC_KEY` — Anthropic (Claude) API key
- `QUACKSTACK_GEMINI_KEY` — Google Gemini key
- `QUACKSTACK_DEEPSEEK_KEY` — DeepSeek API key
- `QUACKSTACK_MISTRAL_KEY` — Mistral API key
- `QUACKSTACK_GROK_KEY` — xAI Grok key
- `QUACKSTACK_PRIMEINTELLECT_KEY` — Prime Intellect API key

How to set env vars locally (example):

```bash
export QUACKSTACK_DATABASE_URL='postgresql://user:pass@localhost:5432/quackstack'
export QUACKSTACK_OPENAI_KEY='sk-xxxx'
```

Database & Prisma: schema, migrations, generate
-----------------------------------------------

1) Generate the Prisma client

```bash
npx prisma generate
```

2) Push schema to DB (non-destructive)

```bash
npx prisma db push
```

3) If you change `prisma/schema.prisma`, create a migration

```bash
npx prisma migrate dev --name "describe-change"
```

Key code snippets and small walkthrough examples
-----------------------------------------------

Example: Add a new file and index only that file (developer quick test)

1) Create `example.ts` in the repo root:

```ts
// example.ts
export function greet(name: string) {
  return `Hello, ${name}!`;
}
```

2) Run the ingest pipeline pointing to repo root (this indexes all supported files in the project):

```bash
node dist/cli.cjs --reindex
```

3) Run REPL and query:

```bash
node dist/cli.cjs
# then:
# quack > how does greet work?
```

Example: Programmatic call to search (from `src/commands/search.ts` usage)

```ts
import { search } from './src/commands/search.js';

const { answer, sources } = await search('how does the authentication work', 'your-project-name');
console.log(answer);
```

Common tasks (indexing, reindexing, switching models)
----------------------------------------------------

- Reindex: `node dist/cli.cjs --reindex` or `quack --reindex`
- Generate context files for tools: `node dist/cli.cjs --context`
- List providers/models: `node dist/cli.cjs --list-models`
- Switch model at runtime in REPL: `/model gpt-5.6-terra`
- Switch provider at runtime in REPL: `/provider anthropic`

Debugging & troubleshooting tips
--------------------------------

- DB connection errors: confirm `QUACKSTACK_DATABASE_URL` and that Postgres is reachable.
- Prisma errors: run `npx prisma studio` and `npx prisma generate` to ensure the client is up to date.
- Git-related errors: `git-history.ts` runs `git` commands — ensure `git` is installed and the project has a `.git` repo.
- No results in search: ensure indexing completed and `codeSnippet` table has rows:

```bash
npx prisma db pull # inspect schema
psql -d quackstack -c 'select count(*) from "codeSnippet";'
```

- If TF-IDF seems off: `local-embeddings` computes IDF across the batch in ingestion; reindex to rebuild IDF.

Adding a new AI provider or model (example)
-----------------------------------------

`src/lib/ai-provider.ts` is where providers and models are declared. To add a provider:

1) Add an environment variable check and provider metadata to `getAvailableProviders()` (see file for examples).
2) Implement the client initialization in `initializeClient()` and provide a `generateX()` method if necessary.
3) Ensure `getDefaultModel()` returns a sensible default.

Snippet example adding `acmeAI` (pseudo):

```ts
if (process.env.QUACKSTACK_ACMEAI_KEY) {
  providers.push({ provider: 'acme', name: 'AcmeAI', models: ['acme-1', 'acme-2'], defaultModel: 'acme-1' });
}

// then in initializeClient()
case 'acme':
  this.acme = new AcmeClient({ apiKey: config.apiKey });
  break;
```

Suggested first PRs or exploration tasks
---------------------------------------

- Add unit tests for `local-embeddings` and `chunker`.
- Improve error handling and logging in `git-history.ts` (shell escapes, better failure messages).
- Add a small integration test that runs `ingest()` on a synthetic repo and asserts DB rows were created.
- Add a `--files` CLI option to index only a provided list of files.

Appendix: useful commands and references
---------------------------------------

- Build: `pnpm build` or `npx tsc`
- Run CLI: `node dist/cli.cjs`
- Generate Prisma client: `npx prisma generate`
- Push schema: `npx prisma db push`
- Create migration: `npx prisma migrate dev --name "desc"`

Developer checklist when re-creating this project from scratch
--------------------------------------------------------------

1) Create `package.json` with dependencies shown in this repo (OpenAI, Anthropic SDKs optional, Prisma and @prisma/client, chalk, commander, typescript, etc.)
2) Add `tsconfig.json` for building to `dist/`
3) Implement `prisma/schema.prisma` as shown here and run `prisma generate` + `prisma db push` against Postgres
4) Implement the minimal pipeline:
   - scanner (file discovery)
   - chunker (AST-based chunking for JS/TS)
   - local embeddings (TF-IDF vectorizer)
   - database (Prisma models + helper functions)
   - search (cosine similarity using same TF-IDF space)
   - ai provider wrapper (one provider is enough to start)
5) Add CLI using `commander` and wire `startREPL()` to interactive queries
