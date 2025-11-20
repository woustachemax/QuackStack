import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

type AIProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "mistral";

interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

interface AvailableProvider {
  provider: AIProvider;
  name: string;
  models: string[];
  defaultModel: string;
}

export class AIClient {
  private provider: AIProvider;
  private model: string;
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private gemini?: GoogleGenerativeAI;
  private deepseek?: OpenAI;
  private mistral?: OpenAI;

  constructor(providerOverride?: AIProvider, modelOverride?: string) {
    const config = this.detectProvider(providerOverride);
    this.provider = config.provider;
    this.model = modelOverride || config.model || this.getDefaultModel(config.provider);
    
    const availableProvider = this.getAvailableProviders().find(p => p.provider === this.provider);
    if (availableProvider && !availableProvider.models.includes(this.model)) {
      throw new Error(
        `Model '${this.model}' not available for ${this.provider}.\n` +
        `Available models: ${availableProvider.models.join(', ')}`
      );
    }
    
    this.initializeClient(config);
  }

  private detectProvider(override?: AIProvider): AIClientConfig {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error(
        "No AI API key found. Set one of:\n" +
        "  QUACKSTACK_OPENAI_KEY\n" +
        "  QUACKSTACK_ANTHROPIC_KEY\n" +
        "  QUACKSTACK_GEMINI_KEY\n" +
        "  QUACKSTACK_DEEPSEEK_KEY\n" +
        "  QUACKSTACK_MISTRAL_KEY"
      );
    }

    if (override) {
      const providerConfig = availableProviders.find(p => p.provider === override);
      if (!providerConfig) {
        throw new Error(
          `Provider '${override}' not available. Set QUACKSTACK_${override.toUpperCase()}_KEY.\n` +
          `Available: ${availableProviders.map(p => p.provider).join(', ')}`
        );
      }
      return {
        provider: override,
        apiKey: this.getApiKey(override)!,
        model: providerConfig.defaultModel
      };
    }

    const first = availableProviders[0];
    return {
      provider: first.provider,
      apiKey: this.getApiKey(first.provider)!,
      model: first.defaultModel
    };
  }

  private getApiKey(provider: AIProvider): string | undefined {
    const keyMap: Record<AIProvider, string> = {
      openai: process.env.QUACKSTACK_OPENAI_KEY || "",
      anthropic: process.env.QUACKSTACK_ANTHROPIC_KEY || "",
      gemini: process.env.QUACKSTACK_GEMINI_KEY || "",
      deepseek: process.env.QUACKSTACK_DEEPSEEK_KEY || "",
      mistral: process.env.QUACKSTACK_MISTRAL_KEY || "",
    };
    return keyMap[provider] || undefined;
  }

  getAvailableProviders(): AvailableProvider[] {
    const providers: AvailableProvider[] = [];

    if (process.env.QUACKSTACK_OPENAI_KEY) {
      providers.push({
        provider: "openai",
        name: "OpenAI",
        models: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "gpt-3.5-turbo"
        ],
        defaultModel: "gpt-4o-mini"
      });
    }

    if (process.env.QUACKSTACK_ANTHROPIC_KEY) {
      providers.push({
        provider: "anthropic",
        name: "Anthropic",
        models: [
          "claude-opus-4-20250514",
          "claude-sonnet-4-20250514",
          "claude-3-7-sonnet-20250219",
          "claude-3-5-haiku-20241022"
        ],
        defaultModel: "claude-sonnet-4-20250514"
      });
    }

    if (process.env.QUACKSTACK_GEMINI_KEY) {
      providers.push({
        provider: "gemini",
        name: "Gemini",
        models: [
          "gemini-2.0-flash-exp",
          "gemini-1.5-pro",
          "gemini-1.5-flash",
          "gemini-1.5-flash-8b"
        ],
        defaultModel: "gemini-1.5-flash"
      });
    }

    if (process.env.QUACKSTACK_DEEPSEEK_KEY) {
      providers.push({
        provider: "deepseek",
        name: "DeepSeek",
        models: [
          "deepseek-chat",
          "deepseek-reasoner"
        ],
        defaultModel: "deepseek-chat"
      });
    }

    if (process.env.QUACKSTACK_MISTRAL_KEY) {
      providers.push({
        provider: "mistral",
        name: "Mistral",
        models: [
          "mistral-large-latest",
          "mistral-small-latest",
          "codestral-latest"
        ],
        defaultModel: "mistral-large-latest"
      });
    }

    return providers;
  }

  private getDefaultModel(provider: AIProvider): string {
    const defaults: Record<AIProvider, string> = {
      openai: "gpt-4o-mini",
      anthropic: "claude-sonnet-4-20250514",
      gemini: "gemini-1.5-flash",
      deepseek: "deepseek-chat",
      mistral: "mistral-large-latest",
    };
    return defaults[provider];
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
      model: this.model,
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
      model: this.model,
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
    const model = this.gemini.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    return result.response.text();
  }
  
  private async generateDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.deepseek) throw new Error("DeepSeek client not initialized");
    const response = await this.deepseek.chat.completions.create({
      model: this.model,
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
      model: this.model,
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
      openai: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini",
      deepseek: "DeepSeek",
      mistral: "Mistral",
    };
    return names[this.provider];
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    const availableProvider = this.getAvailableProviders().find(p => p.provider === this.provider);
    if (availableProvider && !availableProvider.models.includes(model)) {
      throw new Error(
        `Model '${model}' not available for ${this.provider}.\n` +
        `Available models: ${availableProvider.models.join(', ')}`
      );
    }
    this.model = model;
  }
}

let aiClientInstance: AIClient | null = null;

export function getAIClient(provider?: AIProvider, model?: string): AIClient {
  if (!aiClientInstance || provider || model) {
    aiClientInstance = new AIClient(provider, model);
  }
  return aiClientInstance;
}

export function resetAIClient(): void {
  aiClientInstance = null;
}