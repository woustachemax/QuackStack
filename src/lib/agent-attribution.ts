export type AgentConfidence = "high" | "medium" | "low" | "human";

export interface AgentAttribution {
  agentName: string | null;
  confidence: AgentConfidence;
  sessionId: string | null;
}

export interface CadenceSignal {
  commitsInPrior10Min: number;
  filesChanged: number;
  linesChanged: number;
}

interface AgentSignature {
  name: string;
  trailerRegex?: RegExp;
  messageRegex?: RegExp;
  sessionRegex?: RegExp;
}

const CADENCE_BURST_COMMITS = 3;
const CADENCE_BURST_LINES = 150;
const BIG_DIFF_FILES = 8;
const BIG_DIFF_LINES = 400;
const TERSE_MESSAGE_LEN = 20;

const SIGNATURES: AgentSignature[] = [
  {
    name: "Claude Code",
    trailerRegex: /Co-Authored-By:\s*Claude[^<\n]*<noreply@anthropic\.com>/i,
    messageRegex: /Generated with \[?Claude Code\]?|Claude Code session/i,
    sessionRegex: /(?:Claude-Session:\s*\S*?|)(?:session_[A-Za-z0-9]+)/i,
  },
  {
    name: "Cursor",
    trailerRegex: /Co-Authored-By:\s*Cursor(?:\s*Agent)?\s*<[^>\n]*>|Co-Authored-By:[^\n]*<[^>\n]*cursor[^>\n]*>/i,
    messageRegex: /Generated with Cursor|via Cursor Agent/i,
  },
  {
    name: "Windsurf",
    trailerRegex: /Co-Authored-By:\s*Windsurf[^\n]*|Co-Authored-By:[^\n]*<[^>\n]*windsurf[^>\n]*>/i,
    messageRegex: /Generated with Windsurf|via Cascade/i,
  },
  {
    name: "GitHub Copilot",
    trailerRegex: /Co-Authored-By:\s*(?:github-)?copilot[^\n]*<[^>\n]*>|Co-Authored-By:[^\n]*<[^>\n]*copilot[^>\n]*>/i,
  },
  {
    name: "Devin",
    trailerRegex: /Co-Authored-By:\s*Devin[^\n]*|Co-Authored-By:[^\n]*<[^>\n]*devin[^>\n]*>/i,
  },
  {
    name: "Aider",
    messageRegex: /^aider:/im,
  },
];

const GENERIC_AGENT_TRAILER =
  /Co-Authored-By:[^\n]*(bot|agent|claude|copilot|cursor|windsurf|devin|codex|ai)\b/i;

const SESSION_ID = /session[_-]([A-Za-z0-9]{6,})/i;

function extractSessionId(message: string, sig?: AgentSignature): string | null {
  if (sig?.sessionRegex) {
    const m = message.match(sig.sessionRegex);
    if (m) {
      const withId = m[0].match(SESSION_ID);
      if (withId) return withId[1];
    }
  }
  const generic = message.match(SESSION_ID);
  return generic ? generic[1] : null;
}

function nameFromGenericTrailer(message: string): string {
  const line = message.split("\n").find((l) => GENERIC_AGENT_TRAILER.test(l));
  if (!line) return "unknown agent";
  const m = line.match(/Co-Authored-By:\s*([^<]+?)\s*</i);
  return m ? m[1].trim() : "unknown agent";
}

function cadenceLooksAgentic(cadence: CadenceSignal, message: string): boolean {
  const firstLine = message.split("\n")[0].trim();
  const terse = firstLine.length <= TERSE_MESSAGE_LEN && firstLine === firstLine.toLowerCase();

  if (cadence.commitsInPrior10Min >= CADENCE_BURST_COMMITS && cadence.linesChanged >= CADENCE_BURST_LINES) {
    return true;
  }
  if (cadence.filesChanged >= BIG_DIFF_FILES && cadence.linesChanged >= BIG_DIFF_LINES && terse) {
    return true;
  }
  return false;
}

export function classifyCommit(fullMessage: string, cadence?: CadenceSignal): AgentAttribution {
  const message = fullMessage || "";

  for (const sig of SIGNATURES) {
    if (sig.trailerRegex && sig.trailerRegex.test(message)) {
      return { agentName: sig.name, confidence: "high", sessionId: extractSessionId(message, sig) };
    }
  }

  for (const sig of SIGNATURES) {
    if (sig.messageRegex && sig.messageRegex.test(message)) {
      return { agentName: sig.name, confidence: "medium", sessionId: extractSessionId(message, sig) };
    }
  }

  if (GENERIC_AGENT_TRAILER.test(message)) {
    return { agentName: nameFromGenericTrailer(message), confidence: "low", sessionId: extractSessionId(message) };
  }

  if (cadence && cadenceLooksAgentic(cadence, message)) {
    return { agentName: null, confidence: "low", sessionId: null };
  }

  return { agentName: null, confidence: "human", sessionId: null };
}

export function isAgent(attr: AgentAttribution): boolean {
  return attr.confidence !== "human";
}
