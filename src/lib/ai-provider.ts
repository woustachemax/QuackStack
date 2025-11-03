import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

type AIProvider = "openai" | "anthropic";

export class AIClient {
  private provider: AIProvider;
  private openai?: OpenAI;
  private anthropic?: Anthropic;

  constructor() {
    if (process.env.QUACKSTACK_OPENAI_KEY) {
      this.provider = "openai";
      this.openai = new OpenAI({ 
        apiKey: process.env.QUACKSTACK_OPENAI_KEY 
      });
    } else if (process.env.QUACKSTACK_ANTHROPIC_KEY) {
      this.provider = "anthropic";
      this.anthropic = new Anthropic({ 
        apiKey: process.env.QUACKSTACK_ANTHROPIC_KEY 
      });
    } else {
      throw new Error(
        "No AI API key found. Please set either:\n" +
        "  QUACKSTACK_OPENAI_KEY (for OpenAI/GPT)\n" +
        "  QUACKSTACK_ANTHROPIC_KEY (for Claude)"
      );
    }
  }

  async getEmbeddings(text: string): Promise<number[]> {
    const openaiKey = process.env.QUACKSTACK_OPENAI_KEY || process.env.QUACKSTACK_EMBEDDING_KEY;
    
    if (!openaiKey) {
      throw new Error(
        "Embeddings require OpenAI API key.\n" +
        "Set QUACKSTACK_OPENAI_KEY or QUACKSTACK_EMBEDDING_KEY"
      );
    }

    const client = new OpenAI({ apiKey: openaiKey });
    const response = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: text
    });
    return response.data[0].embedding;
  }

  async generateAnswer(query: string, context: string): Promise<string> {
    if (this.provider === "openai" && this.openai) {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a helpful coding assistant. Answer questions about the codebase using the provided code snippets. Be concise and reference specific files when relevant." 
          },
          { 
            role: "user", 
            content: `Code context:\n\n${context}\n\nQuestion: ${query}` 
          }
        ],
        temperature: 0.3,
      });
      return response.choices[0].message.content || "No response generated.";
    } 
    
    if (this.provider === "anthropic" && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: "You are a helpful coding assistant. Answer questions about the codebase using the provided code snippets. Be concise and reference specific files when relevant.",
        messages: [
          { 
            role: "user", 
            content: `Code context:\n\n${context}\n\nQuestion: ${query}` 
          }
        ]
      });
      
      const textContent = response.content.find(c => c.type === "text");
      return textContent && textContent.type === "text" ? textContent.text : "No response generated.";
    }
    
    throw new Error("No AI provider configured");
  }

  getProviderName(): string {
    return this.provider === "openai" ? "OpenAI GPT" : "Anthropic Claude";
  }
}

export const aiClient = new AIClient();