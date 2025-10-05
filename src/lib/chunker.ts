export function chunkText(text: string, maxTokens = 500): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let buffer: string[] = [];

  let tokenCount = 0;
  for (const line of lines) {
    const lineTokens = line.split(/\s+/).length;
    if (tokenCount + lineTokens > maxTokens) {
      chunks.push(buffer.join("\n"));
      buffer = [];
      tokenCount = 0;
    }
    buffer.push(line);
    tokenCount += lineTokens;
  }

  if (buffer.length > 0) chunks.push(buffer.join("\n"));
  return chunks;
}
