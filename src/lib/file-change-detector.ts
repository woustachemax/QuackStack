import fs from "fs";
import path from "path";
import { client } from "./database.js";

interface FileChangeStats {
  newFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  totalChanges: number;
}

export async function detectFileChanges(
  rootDir: string,
  projectName: string
): Promise<FileChangeStats | null> {
  try {
    const existingSnippets = await client.codeSnippet.findMany({
      where: { projectName },
      select: { filePath: true, updatedAt: true },
      distinct: ['filePath'],
    });

    if (existingSnippets.length === 0) {
      return null;
    }

    const lastIndexTime = existingSnippets.reduce((latest, snippet) => {
      return snippet.updatedAt > latest ? snippet.updatedAt : latest;
    }, new Date(0));

    const indexedFiles = new Set(existingSnippets.map(s => s.filePath));

    const currentFiles = await scanDirectory(rootDir);
    const currentFilesSet = new Set(currentFiles);

    let newFiles = 0;
    let modifiedFiles = 0;
    let deletedFiles = 0;

    for (const filePath of currentFiles) {
      if (!indexedFiles.has(filePath)) {
        newFiles++;
      } else {
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime > lastIndexTime) {
            modifiedFiles++;
          }
        } catch (error) {
          continue;
        }
      }
    }

    for (const indexedFile of indexedFiles) {
      if (!currentFilesSet.has(indexedFile)) {
        deletedFiles++;
      }
    }

    const totalChanges = newFiles + modifiedFiles + deletedFiles;

    return {
      newFiles,
      modifiedFiles,
      deletedFiles,
      totalChanges,
    };
  } catch (error) {
    console.error("Error detecting file changes:", error);
    return null;
  }
}

async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = new Set([
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    '.next',
    'coverage',
    '.vscode',
    '.idea'
  ]);

  function walk(currentPath: string) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c',
            '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt', '.scala'
          ];
          
          if (codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
    }
  }

  walk(dir);
  return files;
}

export function formatChangeMessage(stats: FileChangeStats): string {
  const parts: string[] = [];
  
  if (stats.newFiles > 0) {
    parts.push(`${stats.newFiles} new file${stats.newFiles > 1 ? 's' : ''}`);
  }
  if (stats.modifiedFiles > 0) {
    parts.push(`${stats.modifiedFiles} modified file${stats.modifiedFiles > 1 ? 's' : ''}`);
  }
  if (stats.deletedFiles > 0) {
    parts.push(`${stats.deletedFiles} deleted file${stats.deletedFiles > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}