# QuackStack 🐥

**Your cracked unpaid intern for all things codebase related!**

>QuackStack is a CLI tool that lets you **ingest your codebase, generate embeddings, and search across your code** using your own database and OpenAI API key. It’s designed to be simple, dynamic, and fully local to your environment.

---

## Features

* Ingest your project files (`.ts`, `.js`, `.tsx`, `.jsx`, `.py`) and generate embeddings.
* Store embeddings in your own PostgreSQL/Neon database.
* Query your codebase for functions, files, and snippets.
* Fully configurable via `.env` (no hard-coded keys).
* Supports multiple users/projects via database isolation.
* Optional GitHub repo links for richer context.

---

## Requirements

* Node.js v20+
* PostgreSQL or Neon database
* OpenAI API key

---

## Installation

```bash
git clone https://github.com/woustachemax/quackstack.git
cd quackstack

pnpm install

pnpm tsc -b
```

---

## Setup `.env`

Create a `.env` in the project root with:

```env
QUACKSTACK_DATABASE_URL=postgresql://user:pass@host:port/dbname
QUACKSTACK_OPENAI_API_KEY=sk-...
```

> Prisma and OpenAI will read your keys from this `.env`.

---

## Usage

### CLI Options

```bash
node dist/cli.cjs --ingest       
node dist/cli.cjs --query "your question"   
```

### Example

```bash
# Ingest the codebase
node dist/cli.cjs --ingest

# Query the codebase
node dist/cli.cjs --query "How is the database initialized?"
```

---

## Database

The schema uses **Prisma**:

```prisma
model codeSnippet {
  id          Int      @id @default(autoincrement())
  content     String
  embedding   Json
  filePath    String
  projectName String
  language    String?
  functionName String?
  lineStart   Int?
  lineEnd     Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectName])
}
```

* Each project is separated by `projectName`.
* Each file snippet has its embeddings stored in JSON.

> Tip: Make sure `QUACKSTACK_DATABASE_URL` is set properly in `.env`.

---

## Development

```bash
node dist/cli.cjs --ingest

node dist/cli.cjs --query "example question"
```

* Embeddings are generated via OpenAI `text-embedding-3-large`.
* You can extend to other models if needed.
* Add GitHub repo link support by passing `--repo <url>` (planned feature).

---

## Notes

* Designed to be **simple and local** — no user account creation required.
* Scales by letting each user provide their **own database** in `.env`.
* Future improvements: chunking, scanning, better search, multi-model support (Claude, Gemini, etc).

---

## Contributing

Contributions are welcome!
Feel free to submit issues, feature requests, or pull requests.

---
