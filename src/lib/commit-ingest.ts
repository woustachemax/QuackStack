import { chunkCode } from "./chunker.js";
import { gitHistory } from "./git-history.js";
import { clearCommits, saveCommit, saveCommitFiles } from "./database.js";
import { classifyCommit, CadenceSignal } from "./agent-attribution.js";

const CADENCE_WINDOW_MS = 10 * 60 * 1000;

const CODE_EXTENSIONS = new Set([
  "ts", "js", "tsx", "jsx", "mjs", "cjs",
  "py", "pyw", "go", "rs", "java",
  "c", "cpp", "cc", "cxx", "h", "hpp", "hxx",
  "cs", "rb", "php", "swift", "kt", "kts", "scala", "r", "vue", "svelte",
]);

interface TouchedFunction {
  name: string | null;
  lineStart: number | null;
  lineEnd: number | null;
}

function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

function resolveTouchedFunctions(
  hash: string,
  filePath: string,
  hunks: Array<[number, number]>
): TouchedFunction[] {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  if (!CODE_EXTENSIONS.has(ext)) return [];

  const blob = gitHistory.getFileAtCommit(hash, filePath);
  if (blob === null || blob.length > 2_000_000) return [];

  let chunks;
  try {
    chunks = chunkCode(blob, filePath);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const touched: TouchedFunction[] = [];

  for (const chunk of chunks) {
    if (chunk.lineStart == null || chunk.lineEnd == null || !chunk.functionName) continue;
    const chunkRange: [number, number] = [chunk.lineStart, chunk.lineEnd];
    if (hunks.some((h) => rangesOverlap(h, chunkRange))) {
      const key = `${chunk.functionName}:${chunk.lineStart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      touched.push({
        name: chunk.functionName,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
      });
    }
  }

  return touched;
}

export async function ingestCommits(projectName: string, _repoRoot: string): Promise<void> {
  await clearCommits(projectName);

  const commits = gitHistory.getAllCommits();
  if (commits.length === 0) return;

  commits.sort((a, b) => a.date.getTime() - b.date.getTime());

  const timesByAuthor = new Map<string, number[]>();

  for (const commit of commits) {
    const when = commit.date.getTime();
    const prior = timesByAuthor.get(commit.email) || [];
    const commitsInPrior10Min = prior.filter((t) => when - t <= CADENCE_WINDOW_MS && when - t >= 0).length;
    prior.push(when);
    timesByAuthor.set(commit.email, prior);

    const stats = gitHistory.getCommitStats(commit.hash);
    const cadence: CadenceSignal = {
      commitsInPrior10Min,
      filesChanged: stats.filesChanged,
      linesChanged: stats.linesAdded + stats.linesRemoved,
    };

    const attr = classifyCommit(commit.message, cadence);

    await saveCommit({
      hash: commit.hash,
      projectName,
      authorName: commit.author,
      authorEmail: commit.email,
      agentName: attr.agentName,
      agentConfidence: attr.confidence,
      sessionId: attr.sessionId,
      message: commit.message,
      authoredAt: commit.date,
    });

    const hunksByFile = gitHistory.getCommitFileHunks(commit.hash);
    const fileRows = Array.from(hunksByFile.entries()).map(([filePath, hunks]) => ({
      commitHash: commit.hash,
      projectName,
      filePath,
      functionsTouched: resolveTouchedFunctions(commit.hash, filePath, hunks),
    }));

    for (let i = 0; i < fileRows.length; i += 50) {
      await saveCommitFiles(fileRows.slice(i, i + 50));
    }
  }
}
