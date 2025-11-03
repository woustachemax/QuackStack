import fs from "fs";
import path from "path";

const IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  "__pycache__",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
  "vendor",
  "tmp",
  "temp",
];

const DEFAULT_EXTENSIONS = [
  ".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs",
  ".py", ".pyw",
  ".go",
  ".rs",
 ".java",
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
  ".cs",
  ".rb", ".php", ".swift", ".kt", ".kts", ".scala", ".r",
  ".vue", ".svelte",
];

export async function scanDir(
  rootDir: string, 
  exts = DEFAULT_EXTENSIONS
): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (exts.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(rootDir);
  return files;
}