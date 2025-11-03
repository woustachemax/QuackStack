import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

const traverseDefault = (traverse as any).default || traverse;

type CodeChunk = {
  content: string;
  functionName?: string;
  lineStart?: number;
  lineEnd?: number;
};

export function chunkCode(code: string, filePath: string): CodeChunk[] {
  const ext = filePath.split(".").pop()?.toLowerCase();
  
  if (["ts", "js", "tsx", "jsx", "mjs", "cjs"].includes(ext || "")) {
    try {
      return extractJSFunctions(code);
    } catch (e) {
      console.warn(`Failed to parse ${filePath}, using simple chunking`);
    }
  }
  
  return simpleChunk(code);
}

function extractJSFunctions(code: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  
  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      errorRecovery: true,
    });

    traverseDefault(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.start !== null && path.node.end !== null) {
          chunks.push({
            content: code.slice(path.node.start, path.node.end),
            functionName: path.node.id?.name,
            lineStart: path.node.loc?.start.line,
            lineEnd: path.node.loc?.end.line,
          });
        }
      },
      ClassDeclaration(path: any) {
        if (path.node.start !== null && path.node.end !== null) {
          chunks.push({
            content: code.slice(path.node.start, path.node.end),
            functionName: path.node.id?.name,
            lineStart: path.node.loc?.start.line,
            lineEnd: path.node.loc?.end.line,
          });
        }
      },
      ArrowFunctionExpression(path: any) {
        if (path.parent.type === "VariableDeclarator" && 
            path.node.start !== null && 
            path.node.end !== null) {
          const varDeclarator = path.parent;
          const functionName = varDeclarator.id.type === "Identifier" 
            ? varDeclarator.id.name 
            : undefined;
          
          chunks.push({
            content: code.slice(path.node.start, path.node.end),
            functionName,
            lineStart: path.node.loc?.start.line,
            lineEnd: path.node.loc?.end.line,
          });
        }
      },
    });
  } catch (e) {
    return simpleChunk(code);
  }

  return chunks.length > 0 ? chunks : simpleChunk(code);
}

function simpleChunk(code: string, maxLines = 50): CodeChunk[] {
  const lines = code.split("\n");
  const chunks: CodeChunk[] = [];
  
  for (let i = 0; i < lines.length; i += maxLines) {
    const chunk = lines.slice(i, i + maxLines).join("\n");
    chunks.push({
      content: chunk,
      lineStart: i + 1,
      lineEnd: Math.min(i + maxLines, lines.length),
    });
  }
  
  return chunks;
}