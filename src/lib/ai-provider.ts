import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

type AIProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "mistral";

export class AIClient {
  private provider: AIProvider;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private gemini?: GoogleGenerativeAI;
  private deepseek?: OpenAI;
  private mistral?: OpenAI;

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
    } else if (process.env.QUACKSTACK_GEMINI_KEY) {
      this.provider = "gemini";
      this.gemini = new GoogleGenerativeAI(process.env.QUACKSTACK_GEMINI_KEY);
    } else if (process.env.QUACKSTACK_DEEPSEEK_KEY) {
      this.provider = "deepseek";
      this.deepseek = new OpenAI({
        apiKey: process.env.QUACKSTACK_DEEPSEEK_KEY,
        baseURL: "https://api.deepseek.com/v1"
      });
    } else if (process.env.QUACKSTACK_MISTRAL_KEY) {
      this.provider = "mistral";
      this.mistral = new OpenAI({
        apiKey: process.env.QUACKSTACK_MISTRAL_KEY,
        baseURL: "https://api.mistral.ai/v1"
      });
    } else {
      throw new Error(
        "No AI API key found. Please set one of:\n" +
        "  QUACKSTACK_OPENAI_KEY (GPT-4)\n" +
        "  QUACKSTACK_ANTHROPIC_KEY (Claude)\n" +
        "  QUACKSTACK_GEMINI_KEY (Gemini)\n" +
        "  QUACKSTACK_DEEPSEEK_KEY (DeepSeek)\n" +
        "  QUACKSTACK_MISTRAL_KEY (Mistral)"
      );
    }
  }

  async getEmbeddings(text: string): Promise<number[]> {
    const embeddingKey = process.env.QUACKSTACK_OPENAI_KEY || 
                         process.env.QUACKSTACK_EMBEDDING_KEY;
    
    if (embeddingKey) {
      const client = new OpenAI({ apiKey: embeddingKey });
      const response = await client.embeddings.create({
        model: "text-embedding-3-large",
        input: text
      });
      return response.data[0].embedding;
    }

    if (process.env.QUACKSTACK_DEEPSEEK_KEY) {
      const client = new OpenAI({
        apiKey: process.env.QUACKSTACK_DEEPSEEK_KEY,
        baseURL: "https://api.deepseek.com/v1"
      });
      const response = await client.embeddings.create({
        model: "deepseek-chat",
        input: text
      });
      return response.data[0].embedding;
    }

    throw new Error(
      "Embeddings require an API key. Set one of:\n" +
      "  QUACKSTACK_OPENAI_KEY\n" +
      "  QUACKSTACK_DEEPSEEK_KEY\n" +
      "  QUACKSTACK_EMBEDDING_KEY"
    );
  }

  async generateAnswer(query: string, context: string): Promise<string> {
    const systemPrompt = "You are a helpful coding assistant. Answer questions about the codebase using the provided code snippets. Be concise and reference specific files when relevant.";
    const userPrompt = `Code context:\n\n${context}\n\nQuestion: ${query}`;

    if (this.provider === "openai" && this.openai) {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      });
      return response.choices[0].message.content || "No response generated.";
    }

    if (this.provider === "anthropic" && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt }
        ]
      });
      const textContent = response.content.find(c => c.type === "text");
      return textContent && textContent.type === "text" ? textContent.text : "No response generated.";
    }

    if (this.provider === "gemini" && this.gemini) {
      const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      return result.response.text();
    }

    if (this.provider === "deepseek" && this.deepseek) {
      const response = await this.deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      });
      return response.choices[0].message.content || "No response generated.";
    }

    if (this.provider === "mistral" && this.mistral) {
      const response = await this.mistral.chat.completions.create({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      });
      return response.choices[0].message.content || "No response generated.";
    }
    
    throw new Error("No AI provider configured");
  }

  getProviderName(): string {
    const names = {
      openai: "OpenAI GPT",
      anthropic: "Anthropic Claude",
      gemini: "Google Gemini",
      deepseek: "DeepSeek",
      mistral: "Mistral AI"
    };
    return names[this.provider];
  }
}

export const aiClient = new AIClient();