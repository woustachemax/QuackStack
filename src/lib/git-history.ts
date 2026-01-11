import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  filesChanged: string[];
}

export interface GitBlameInfo {
  author: string;
  email: string;
  date: Date;
  commitHash: string;
  lineNumber: number;
}

export interface FileHistory {
  filePath: string;
  commits: GitCommit[];
  lastModified: Date;
  lastAuthor: string;
  totalCommits: number;
  primaryAuthors: Array<{ author: string; email: string; commitCount: number }>;
}

export interface AuthorStats {
  author: string;
  email: string;
  totalCommits: number;
  filesOwned: string[];
  recentActivity: Date;
  linesAdded: number;
  linesRemoved: number;
}

export class GitHistory {
  private repoRoot: string;
  private isGitRepo: boolean;

  constructor(projectPath: string = process.cwd()) {
    this.repoRoot = this.findGitRoot(projectPath);
    this.isGitRepo = this.repoRoot !== "";
  }

  private findGitRoot(startPath: string): string {
    try {
      const result = execSync("git rev-parse --show-toplevel", {
        cwd: startPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return result;
    } catch {
      return "";
    }
  }

  isRepository(): boolean {
    return this.isGitRepo;
  }

  getFileHistory(filePath: string, limit: number = 10): FileHistory | null {
    if (!this.isGitRepo) return null;

    try {
      const relativePath = path.relative(this.repoRoot, filePath);
      
      // Get commit history for file
      const logOutput = execSync(
        `git log --follow --format="%H|%an|%ae|%aI|%s" -n ${limit} -- "${relativePath}"`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();

      if (!logOutput) return null;

      const commits: GitCommit[] = logOutput.split("\n").map(line => {
        const [hash, author, email, date, ...messageParts] = line.split("|");
        return {
          hash,
          author,
          email,
          date: new Date(date),
          message: messageParts.join("|"),
          filesChanged: [relativePath],
        };
      });

      // Get author statistics
      const authorMap = new Map<string, { author: string; email: string; commitCount: number }>();
      commits.forEach(commit => {
        const key = commit.email;
        if (authorMap.has(key)) {
          authorMap.get(key)!.commitCount++;
        } else {
          authorMap.set(key, {
            author: commit.author,
            email: commit.email,
            commitCount: 1,
          });
        }
      });

      const primaryAuthors = Array.from(authorMap.values())
        .sort((a, b) => b.commitCount - a.commitCount);

      return {
        filePath: relativePath,
        commits,
        lastModified: commits[0]?.date || new Date(),
        lastAuthor: commits[0]?.author || "Unknown",
        totalCommits: commits.length,
        primaryAuthors,
      };
    } catch (error) {
      console.error(`Error getting history for ${filePath}:`, error);
      return null;
    }
  }

  getBlameInfo(filePath: string): GitBlameInfo[] | null {
    if (!this.isGitRepo) return null;

    try {
      const relativePath = path.relative(this.repoRoot, filePath);
      
      if (!fs.existsSync(filePath)) return null;

      const blameOutput = execSync(
        `git blame --line-porcelain "${relativePath}"`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      const lines = blameOutput.split("\n");
      const blameInfo: GitBlameInfo[] = [];
      let currentInfo: Partial<GitBlameInfo> = {};
      let lineNumber = 0;

      for (const line of lines) {
        if (line.match(/^[0-9a-f]{40}/)) {
          if (currentInfo.commitHash) {
            blameInfo.push(currentInfo as GitBlameInfo);
          }
          currentInfo = {
            commitHash: line.split(" ")[0],
            lineNumber: ++lineNumber,
          };
        } else if (line.startsWith("author ")) {
          currentInfo.author = line.substring(7);
        } else if (line.startsWith("author-mail ")) {
          currentInfo.email = line.substring(12).replace(/[<>]/g, "");
        } else if (line.startsWith("author-time ")) {
          currentInfo.date = new Date(parseInt(line.substring(12)) * 1000);
        }
      }

      if (currentInfo.commitHash) {
        blameInfo.push(currentInfo as GitBlameInfo);
      }

      return blameInfo;
    } catch (error) {
      console.error(`Error getting blame for ${filePath}:`, error);
      return null;
    }
  }

  getRecentCommits(limit: number = 50): GitCommit[] {
    if (!this.isGitRepo) return [];

    try {
      const logOutput = execSync(
        `git log --format="%H|%an|%ae|%aI|%s" --name-only -n ${limit}`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();

      const commits: GitCommit[] = [];
      const blocks = logOutput.split("\n\n");

      for (const block of blocks) {
        const lines = block.split("\n");
        if (lines.length < 1) continue;

        const [hash, author, email, date, ...messageParts] = lines[0].split("|");
        const filesChanged = lines.slice(1).filter(f => f.trim());

        commits.push({
          hash,
          author,
          email,
          date: new Date(date),
          message: messageParts.join("|"),
          filesChanged,
        });
      }

      return commits;
    } catch (error) {
      console.error("Error getting recent commits:", error);
      return [];
    }
  }

  getAuthorStats(): AuthorStats[] {
    if (!this.isGitRepo) return [];

    try {
      // Get basic author stats
      const authorOutput = execSync(
        `git shortlog -sne --all`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();

      const authorMap = new Map<string, AuthorStats>();

      authorOutput.split("\n").forEach(line => {
        const match = line.match(/^\s*(\d+)\s+(.+?)\s+<(.+?)>/);
        if (match) {
          const [, commits, author, email] = match;
          authorMap.set(email, {
            author,
            email,
            totalCommits: parseInt(commits),
            filesOwned: [],
            recentActivity: new Date(0),
            linesAdded: 0,
            linesRemoved: 0,
          });
        }
      });

      // Get recent activity for each author
      authorMap.forEach((stats, email) => {
        try {
          const lastCommit = execSync(
            `git log --author="${email}" -1 --format="%aI"`,
            {
              cwd: this.repoRoot,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }
          ).trim();
          
          if (lastCommit) {
            stats.recentActivity = new Date(lastCommit);
          }

          // Get line changes
          const lineStats = execSync(
            `git log --author="${email}" --pretty=tformat: --numstat`,
            {
              cwd: this.repoRoot,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }
          ).trim();

          lineStats.split("\n").forEach(line => {
            const [added, removed] = line.split("\t").map(n => parseInt(n) || 0);
            stats.linesAdded += added;
            stats.linesRemoved += removed;
          });
        } catch {
          // Ignore errors for individual authors
        }
      });

      return Array.from(authorMap.values())
        .sort((a, b) => b.totalCommits - a.totalCommits);
    } catch (error) {
      console.error("Error getting author stats:", error);
      return [];
    }
  }

  getRecentlyChangedFiles(days: number = 7): Array<{ filePath: string; lastModified: Date; author: string }> {
    if (!this.isGitRepo) return [];

    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      const output = execSync(
        `git log --since="${sinceStr}" --format="%aI|%an" --name-only`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();

      const fileMap = new Map<string, { lastModified: Date; author: string }>();
      const blocks = output.split("\n\n");

      for (const block of blocks) {
        const lines = block.split("\n");
        if (lines.length < 1) continue;

        const [dateStr, author] = lines[0].split("|");
        const date = new Date(dateStr);
        const files = lines.slice(1).filter(f => f.trim());

        files.forEach(file => {
          if (!fileMap.has(file) || fileMap.get(file)!.lastModified < date) {
            fileMap.set(file, { lastModified: date, author });
          }
        });
      }

      return Array.from(fileMap.entries())
        .map(([filePath, info]) => ({ filePath, ...info }))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      console.error("Error getting recently changed files:", error);
      return [];
    }
  }

  getFileOwner(filePath: string): { author: string; email: string; commitCount: number } | null {
    const history = this.getFileHistory(filePath, 100);
    if (!history || history.primaryAuthors.length === 0) return null;
    return history.primaryAuthors[0];
  }

  getCommitMessage(commitHash: string): string | null {
    if (!this.isGitRepo) return null;

    try {
      return execSync(
        `git log --format=%B -n 1 ${commitHash}`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();
    } catch {
      return null;
    }
  }

  hasUncommittedChanges(filePath: string): boolean {
    if (!this.isGitRepo) return false;

    try {
      const relativePath = path.relative(this.repoRoot, filePath);
      const status = execSync(
        `git status --porcelain "${relativePath}"`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();

      return status.length > 0;
    } catch {
      return false;
    }
  }

  getCurrentBranch(): string | null {
    if (!this.isGitRepo) return null;

    try {
      return execSync(
        `git rev-parse --abbrev-ref HEAD`,
        {
          cwd: this.repoRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();
    } catch {
      return null;
    }
  }

  getRepositoryRoot(): string {
    return this.repoRoot;
  }
}

export const gitHistory = new GitHistory();