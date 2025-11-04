import { client } from "./database.js";

type ConversationEntry = {
  query: string;
  answer: string;
  provider: string;
  timestamp: Date;
};

export class SessionManager {
  private projectName: string;
  private sessionId: string;
  private conversations: ConversationEntry[] = [];

  constructor(projectName: string) {
    this.projectName = projectName;
    this.sessionId = new Date().toISOString();
  }

  async addConversation(query: string, answer: string, provider: string) {
    this.conversations.push({
      query,
      answer,
      provider,
      timestamp: new Date(),
    });

    await this.saveToDatabase();
  }

  async saveToDatabase() {
    const sessionData = {
      projectName: this.projectName,
      sessionId: this.sessionId,
      conversations: JSON.stringify(this.conversations),
    };

    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    
    const sessionDir = path.join(os.homedir(), ".quackstack", "sessions");
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const sessionFile = path.join(sessionDir, `${this.projectName}-${this.sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(this.conversations, null, 2));
  }

  getConversationHistory(): string {
    return this.conversations
      .map(c => `Q: ${c.query}\nA: ${c.answer}\n(via ${c.provider})\n`)
      .join("\n---\n\n");
  }

  async loadPreviousSession(): Promise<void> {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    
    const sessionDir = path.join(os.homedir(), ".quackstack", "sessions");
    if (!fs.existsSync(sessionDir)) return;

    const files = fs.readdirSync(sessionDir)
      .filter(f => f.startsWith(this.projectName))
      .sort()
      .reverse();

    if (files.length > 0) {
      const latestSession = path.join(sessionDir, files[0]);
      const data = JSON.parse(fs.readFileSync(latestSession, "utf-8"));
      this.conversations = data;
    }
  }
}