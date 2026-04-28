import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

export type AIProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "mistral" | "grok";

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
  private grok?: OpenAI;

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
        "  QUACKSTACK_MISTRAL_KEY\n" +
        "  QUACKSTACK_GROK_KEY"
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
      grok: process.env.QUACKSTACK_GROK_KEY || "",
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
          "gpt-5.5",
          "gpt-5.4",
          "gpt-5.4-mini",
          "gpt-5.3-codex",
          "gpt-5.3-instant",
          "gpt-4o",
          "gpt-4o-mini",
        ],
        defaultModel: "gpt-5.5"
      });
    }

    if (process.env.QUACKSTACK_ANTHROPIC_KEY) {
      providers.push({
        provider: "anthropic",
        name: "Anthropic",
        models: [
          "claude-opus-4-7",
          "claude-sonnet-4-6",
          "claude-haiku-4-5-20251001",
          "claude-opus-4-6",
          "claude-sonnet-4-5-20250929",
          "claude-opus-4-5-20251101",
          "claude-opus-4-1-20250805",
        ],
        defaultModel: "claude-opus-4-7"
      });
    }

    if (process.env.QUACKSTACK_GEMINI_KEY) {
      providers.push({
        provider: "gemini",
        name: "Gemini",
        models: [
          "gemini-3.1-pro-preview",
          "gemini-3-flash-preview",
          "gemini-3.1-flash-lite-preview",
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
        ],
        defaultModel: "gemini-3.1-pro-preview"
      });
    }

    if (process.env.QUACKSTACK_DEEPSEEK_KEY) {
      providers.push({
        provider: "deepseek",
        name: "DeepSeek",
        models: [
          "deepseek-v4-pro",
          "deepseek-v4-flash",
        ],
        defaultModel: "deepseek-v4-pro"
      });
    }

    if (process.env.QUACKSTACK_MISTRAL_KEY) {
      providers.push({
        provider: "mistral",
        name: "Mistral",
        models: [
          "mistral-large-3-25-12",
          "mistral-medium-3-1-25-08",
          "mistral-small-4-0-26-03",
          "devstral-2-25-12",
          "codestral-25-08",
          "magistral-medium-1-2-25-09",
          "magistral-small-1-2-25-09",
        ],
        defaultModel: "mistral-large-3-25-12"
      });
    }

    if (process.env.QUACKSTACK_GROK_KEY) {
      providers.push({
        provider: "grok",
        name: "xAI Grok",
        models: [
          "grok-4.20-reasoning",
          "grok-4.20-non-reasoning",
          "grok-4-1-fast-reasoning",
          "grok-4-1-fast-non-reasoning",
        ],
        defaultModel: "grok-4.20-reasoning"
      });
    }

    return providers;
  }

  private getDefaultModel(provider: AIProvider): string {
    const defaults: Record<AIProvider, string> = {
      openai: "gpt-5.5",
      anthropic: "claude-opus-4-7",
      gemini: "gemini-3.1-pro-preview",
      deepseek: "deepseek-v4-pro",
      mistral: "mistral-large-3-25-12",
      grok: "grok-4.20-reasoning",
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
      case "grok":
        this.grok = new OpenAI({
          apiKey: config.apiKey,
          baseURL: "https://api.x.ai/v1",
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
        case "grok":
          return await this.generateGrok(systemPrompt, userPrompt);
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

  private async generateGrok(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.grok) throw new Error("Grok client not initialized");
    const response = await this.grok.chat.completions.create({
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
      grok: "xAI Grok",
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