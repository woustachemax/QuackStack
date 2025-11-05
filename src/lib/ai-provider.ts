import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

type AIProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "mistral";

interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
}

export class AIClient {
  private provider: AIProvider;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private gemini?: GoogleGenerativeAI;
  private deepseek?: OpenAI;
  private mistral?: OpenAI;

  constructor() {
    const config = this.detectProvider();
    this.provider = config.provider;
    this.initializeClient(config);
  }


  private detectProvider(): AIClientConfig {
    if (process.env.QUACKSTACK_OPENAI_KEY) {
      return {
        provider: "openai",
        apiKey: process.env.QUACKSTACK_OPENAI_KEY,
      };
    }
    
    if (process.env.QUACKSTACK_ANTHROPIC_KEY) {
      return {
        provider: "anthropic",
        apiKey: process.env.QUACKSTACK_ANTHROPIC_KEY,
      };
    }
    
    if (process.env.QUACKSTACK_GEMINI_KEY) {
      return {
        provider: "gemini",
        apiKey: process.env.QUACKSTACK_GEMINI_KEY,
      };
    }
    
    if (process.env.QUACKSTACK_DEEPSEEK_KEY) {
      return {
        provider: "deepseek",
        apiKey: process.env.QUACKSTACK_DEEPSEEK_KEY,
      };
    }
    
    if (process.env.QUACKSTACK_MISTRAL_KEY) {
      return {
        provider: "mistral",
        apiKey: process.env.QUACKSTACK_MISTRAL_KEY,
      };
    }

    throw new Error(
      "No AI API key found. Please set one of:\n" +
      "  QUACKSTACK_OPENAI_KEY      - OpenAI GPT-4\n" +
      "  QUACKSTACK_ANTHROPIC_KEY   - Anthropic Claude\n" +
      "  QUACKSTACK_GEMINI_KEY      - Google Gemini (free tier available)\n" +
      "  QUACKSTACK_DEEPSEEK_KEY    - DeepSeek (cheapest option)\n" +
      "  QUACKSTACK_MISTRAL_KEY     - Mistral AI\n\n" +
      "Get your API key from the respective provider's website."
    );
  }

 
  private initializeClient(config: AIClientConfig): void {
    switch (config.provider) {
      case "openai":
        this.openai = new OpenAI({ apiKey: config.apiKey });
        break;

      case "anthropic":
        this.anthropic = new Anthropic({ apiKey: config.apiKey });
        break;

      case "gemini":
        this.gemini = new GoogleGenerativeAI(config.apiKey);
        break;

      case "deepseek":
        this.deepseek = new OpenAI({
          apiKey: config.apiKey,
          baseURL: "https://api.deepseek.com/v1",
        });
        break;

      case "mistral":
        this.mistral = new OpenAI({
          apiKey: config.apiKey,
          baseURL: "https://api.mistral.ai/v1",
        });
        break;
    }
  }

 
  async generateAnswer(query: string, context: string): Promise<string> {
    const systemPrompt = 
      "You are a helpful coding assistant. Answer questions about the codebase using the provided code snippets. " +
      "Be concise and reference specific files when relevant. Format your responses in markdown for clarity.";
    
    const userPrompt = `Code context:\n\n${context}\n\nQuestion: ${query}`;

    try {
      switch (this.provider) {
        case "openai":
          return await this.generateOpenAI(systemPrompt, userPrompt);

        case "anthropic":
          return await this.generateAnthropic(systemPrompt, userPrompt);

        case "gemini":
          return await this.generateGemini(systemPrompt, userPrompt);

        case "deepseek":
          return await this.generateDeepSeek(systemPrompt, userPrompt);

        case "mistral":
          return await this.generateMistral(systemPrompt, userPrompt);

        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI generation failed: ${error.message}`);
      }
      throw new Error("AI generation failed with unknown error");
    }
  }


  private async generateOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.openai) throw new Error("OpenAI client not initialized");

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    return response.choices[0].message.content || "No response generated.";
  }

 
  private async generateAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.anthropic) throw new Error("Anthropic client not initialized");

    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    return textContent && textContent.type === "text" 
      ? textContent.text 
      : "No response generated.";
  }

  
  private async generateGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.gemini) throw new Error("Gemini client not initialized");

    const model = this.gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    
    return result.response.text();
  }

  
  private async generateDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.deepseek) throw new Error("DeepSeek client not initialized");

    const response = await this.deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    return response.choices[0].message.content || "No response generated.";
  }

  
  private async generateMistral(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.mistral) throw new Error("Mistral client not initialized");

    const response = await this.mistral.chat.completions.create({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    return response.choices[0].message.content || "No response generated.";
  }

  
  getProviderName(): string {
    const names: Record<AIProvider, string> = {
      openai: "OpenAI GPT",
      anthropic: "Anthropic Claude",
      gemini: "Google Gemini",
      deepseek: "DeepSeek",
      mistral: "Mistral AI",
    };
    return names[this.provider];
  }

 
  getProvider(): AIProvider {
    return this.provider;
  }
}

let aiClientInstance: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient();
  }
  return aiClientInstance;
}