import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.QUACKSTACK_OPENAI_API_KEY,
});

type SearchResult = {
  content: string;
  filePath: string;
  score: number;
};

export async function generateAnswer(query: string, results: SearchResult[]) {
  const context = results
    .map((r, i) => `[${i + 1}] ${r.filePath}\n${r.content}`)
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", 
    messages: [
      {
        role: "system",
        content: `
        You are a precise and context-aware coding assistant integrated into a CLI tool.
        Your job is to answer technical questions about a users codebase using the provided file contents, function definitions, or directory structures.

        Behavior:

        Always reference specific files, functions, or classes when relevant (e.g., "In db/models.py, the User class...").

        Be concise and factual.

        Do not speculate beyond the given code snippets.

        If context is missing, state clearly whats missing.

        Treat user queries as about the codebase (e.g., “what does code in my db do?”) and infer meaning from filenames, docstrings, and code structure.

        Example queries:

        “what does code in my db do?” → Summarize DB-related modules.

        “how is authentication implemented?” → Trace relevant functions/files.

        “where is API routing defined?” → Identify routing logic by filename and function.
        Always format your answers in markdown for clarity.`,
      },
      {
        role: "user",
        content: `Code context:\n\n${context}\n\nQuestion: ${query}`,
      },
    ],
    temperature: 0.3,
  });

  return response.choices[0].message.content;
}