import { client } from "../lib/database.js";
import { getAIClient } from "../lib/ai-provider.js";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

async function askQuestion(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function generateReadme(projectName: string, outputPath?: string) {
  const readmePath = outputPath || path.join(process.cwd(), "README.md");
  const exists = await fs.access(readmePath).then(() => true).catch(() => false);
  
  if (exists) {
    const shouldOverwrite = await askQuestion("⚠️  README.md already exists. Overwrite? (y/n): ");
    if (!shouldOverwrite) {
      console.log("Cancelled.");
      return;
    }
  }

  const snippets = await client.codeSnippet.findMany({
    where: { projectName },
  });

  const fileStructure = [...new Set(snippets.map(s => s.filePath))].sort();
  const technologies = detectTechnologies(snippets);
  const entryPoints = findEntryPoints(snippets);
  
  const context = `
Project Structure:
${fileStructure.map(f => `- ${f}`).join('\n')}

Technologies Detected:
${technologies.join(', ')}

Entry Points:
${entryPoints.map(e => `- ${e.filePath} (${e.functionName})`).join('\n')}

Sample Code Snippets:
${snippets.slice(0, 10).map(s => `
File: ${s.filePath}
${s.content.slice(0, 200)}...
`).join('\n---\n')}
  `;

  const aiClient = getAIClient();
  const prompt = `
You are a technical documentation expert. Based on the following codebase context, generate a comprehensive README.md file.

Include:
- Project title and description
- Technologies used
- Installation instructions
- Usage examples
- Project structure overview
- Key features
- Contributing guidelines (basic)

Make it professional, clear, and actionable.

Context:
${context}
`;

  console.log("🦆 Generating README.md...");
  const readme = await aiClient.generateAnswer(prompt, context);

  await fs.writeFile(readmePath, readme, "utf-8");
  console.log(`✅ README.md generated at ${readmePath}`);
}

function detectTechnologies(snippets: any[]): string[] {
  const techs = new Set<string>();
  
  snippets.forEach(s => {
    const filePath = s.filePath.toLowerCase();
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) techs.add('React');
    if (filePath.endsWith('.ts')) techs.add('TypeScript');
    if (filePath.endsWith('.py')) techs.add('Python');
    if (filePath.endsWith('.rs')) techs.add('Rust');
    if (filePath.includes('prisma')) techs.add('Prisma');
    if (s.content.includes('express')) techs.add('Express');
    if (s.content.includes('fastapi')) techs.add('FastAPI');
    if (s.content.includes('django')) techs.add('Django');
  });
  
  return Array.from(techs);
}

function findEntryPoints(snippets: any[]) {
  return snippets.filter(s => 
    s.filePath.includes('main') || 
    s.filePath.includes('index') ||
    s.filePath.includes('app') ||
    s.functionName?.toLowerCase().includes('main')
  ).slice(0, 5);
}