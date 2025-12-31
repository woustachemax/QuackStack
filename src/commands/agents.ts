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

export async function generateAgentMd(projectName: string, outputPath?: string) {
  const agentPath = outputPath || path.join(process.cwd(), "AGENTS.md");
  const exists = await fs.access(agentPath).then(() => true).catch(() => false);
  
  if (exists) {
    const shouldOverwrite = await askQuestion("⚠️  AGENTS.md already exists. Overwrite? (y/n): ");
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
  const apiEndpoints = detectAPIEndpoints(snippets);
  const dataModels = detectDataModels(snippets);
  const toolsAndDeps = detectToolsAndDependencies(snippets);
  
  const context = `
Project: ${projectName}

File Structure (${fileStructure.length} files):
${fileStructure.slice(0, 50).map(f => `- ${f}`).join('\n')}
${fileStructure.length > 50 ? `... and ${fileStructure.length - 50} more files` : ''}

Technologies & Frameworks:
${technologies.join(', ')}

Tools & Dependencies:
${toolsAndDeps.join(', ')}

API Endpoints:
${apiEndpoints.slice(0, 10).map(e => `- ${e}`).join('\n')}

Data Models:
${dataModels.slice(0, 10).map(m => `- ${m}`).join('\n')}

Key Code Patterns:
${analyzeCodePatterns(snippets)}

Sample Implementation Details:
${snippets.slice(0, 15).map(s => `
File: ${s.filePath}
${s.content.slice(0, 300)}...
`).join('\n---\n')}
  `;

  const aiClient = getAIClient();
  const prompt = `
You are an expert at creating AGENTS.md files following the agents.md specification (https://agents.md/).

Based on the codebase context provided, generate a comprehensive AGENTS.md file that describes this project as an AI agent.

The AGENTS.md should include:

# Agent Metadata
- name: A descriptive name for this codebase agent
- description: What this agent/codebase does
- version: Current version
- author: Project author/team

# Capabilities
List what this agent can do based on the codebase:
- Key features and functionalities
- Available commands/operations
- API endpoints (if applicable)
- Data processing capabilities

# Technologies
- Programming languages
- Frameworks and libraries
- Database systems
- External services/APIs

# Configuration
- Environment variables needed
- Required API keys
- Setup requirements

# Usage Examples
- How to interact with this agent
- Common commands or API calls
- Example queries or operations

# Context & Knowledge
- What domain knowledge this agent has
- What it understands about the project structure
- Key architectural patterns

# Constraints & Limitations
- What the agent cannot do
- Known limitations
- Security considerations

# Tools & Integrations
- External tools used
- Available integrations
- CLI commands

Make it detailed, actionable, and follow the agents.md spec format with proper markdown sections.

Codebase Context:
${context}
`;

  console.log("Generating AGENTS.md...");
  const agentMd = await aiClient.generateAnswer(prompt, context);

  await fs.writeFile(agentPath, agentMd, "utf-8");
  console.log(`AGENTS.md generated at ${agentPath}`);
}

function detectTechnologies(snippets: any[]): string[] {
  const techs = new Set<string>();
  
  snippets.forEach(s => {
    const filePath = s.filePath.toLowerCase();
    const content = s.content.toLowerCase();
    
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) techs.add('React');
    if (filePath.endsWith('.ts')) techs.add('TypeScript');
    if (filePath.endsWith('.js')) techs.add('JavaScript');
    if (filePath.endsWith('.py')) techs.add('Python');
    if (filePath.endsWith('.rs')) techs.add('Rust');
    if (filePath.endsWith('.go')) techs.add('Go');
    if (filePath.endsWith('.java')) techs.add('Java');
    
    if (filePath.includes('prisma') || content.includes('prisma')) techs.add('Prisma');
    if (content.includes('express')) techs.add('Express');
    if (content.includes('fastapi')) techs.add('FastAPI');
    if (content.includes('django')) techs.add('Django');
    if (content.includes('next')) techs.add('Next.js');
    if (content.includes('vue')) techs.add('Vue');
    if (content.includes('svelte')) techs.add('Svelte');
    if (content.includes('flask')) techs.add('Flask');
    
    if (content.includes('postgres') || content.includes('postgresql')) techs.add('PostgreSQL');
    if (content.includes('mongodb')) techs.add('MongoDB');
    if (content.includes('redis')) techs.add('Redis');
    if (content.includes('mysql')) techs.add('MySQL');
    
    if (content.includes('docker')) techs.add('Docker');
    if (content.includes('kubernetes')) techs.add('Kubernetes');
    if (content.includes('graphql')) techs.add('GraphQL');
    if (content.includes('grpc')) techs.add('gRPC');
  });
  
  return Array.from(techs);
}

function detectAPIEndpoints(snippets: any[]): string[] {
  const endpoints = new Set<string>();
  
  snippets.forEach(s => {
    const content = s.content;
    
    const expressMatches = content.matchAll(/(?:app|router)\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g);
    for (const match of expressMatches) {
      endpoints.add(`${match[1].toUpperCase()} ${match[2]}`);
    }
    
    const pythonMatches = content.matchAll(/@(?:app|router|api)\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g);
    for (const match of pythonMatches) {
      endpoints.add(`${match[1].toUpperCase()} ${match[2]}`);
    }
  });
  
  return Array.from(endpoints);
}

function detectDataModels(snippets: any[]): string[] {
  const models = new Set<string>();
  
  snippets.forEach(s => {
    const content = s.content;
    
    const prismaMatches = content.matchAll(/model\s+(\w+)\s*{/g);
    for (const match of prismaMatches) {
      models.add(`Prisma: ${match[1]}`);
    }
    
    const tsMatches = content.matchAll(/(?:interface|type)\s+(\w+)\s*[={]/g);
    for (const match of tsMatches) {
      if (match[1].length > 2 && match[1][0] === match[1][0].toUpperCase()) {
        models.add(`Type: ${match[1]}`);
      }
    }
    
    const pyMatches = content.matchAll(/class\s+(\w+)(?:\(.*?\))?:/g);
    for (const match of pyMatches) {
      models.add(`Class: ${match[1]}`);
    }
  });
  
  return Array.from(models).slice(0, 20);
}

function detectToolsAndDependencies(snippets: any[]): string[] {
  const tools = new Set<string>();
  
  snippets.forEach(s => {
    const content = s.content.toLowerCase();
    
    if (content.includes('axios')) tools.add('Axios');
    if (content.includes('fetch')) tools.add('Fetch API');
    if (content.includes('chalk')) tools.add('Chalk');
    if (content.includes('commander')) tools.add('Commander');
    if (content.includes('readline')) tools.add('Readline');
    if (content.includes('openai')) tools.add('OpenAI');
    if (content.includes('anthropic')) tools.add('Anthropic');
    if (content.includes('langchain')) tools.add('LangChain');
    if (content.includes('pinecone')) tools.add('Pinecone');
    if (content.includes('supabase')) tools.add('Supabase');
    if (content.includes('stripe')) tools.add('Stripe');
    if (content.includes('aws')) tools.add('AWS');
    if (content.includes('vercel')) tools.add('Vercel');
  });
  
  return Array.from(tools);
}

function analyzeCodePatterns(snippets: any[]): string {
  let patterns: string[] = [];
  
  const hasAsync = snippets.some(s => s.content.includes('async'));
  const hasPromises = snippets.some(s => s.content.includes('Promise'));
  const hasClasses = snippets.some(s => /class\s+\w+/.test(s.content));
  const hasFunctional = snippets.some(s => /const\s+\w+\s*=\s*\(.*?\)\s*=>/.test(s.content));
  const hasErrorHandling = snippets.some(s => s.content.includes('try') && s.content.includes('catch'));
  
  if (hasAsync || hasPromises) patterns.push('Asynchronous operations');
  if (hasClasses) patterns.push('Object-oriented patterns');
  if (hasFunctional) patterns.push('Functional programming');
  if (hasErrorHandling) patterns.push('Error handling with try-catch');
  
  return patterns.join(', ') || 'Standard procedural code';
}