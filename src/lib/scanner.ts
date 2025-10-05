import fs from "fs";
import path from "path";

export async function scanDir(rootDir: string, exts = [".ts", ".js", ".tsx", ".jsx", ".py"]): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (exts.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}