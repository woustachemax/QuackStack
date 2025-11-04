import crypto from "crypto";

type TFIDFVector = Map<string, number>;

export class LocalEmbeddings {
  private idf: Map<string, number> = new Map();
  private documents: string[] = [];

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  computeTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    tokens.forEach(token => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });
    tokens.forEach(token => {
      tf.set(token, tf.get(token)! / tokens.length);
    });
    return tf;
  }

  computeIDF(documents: string[][]) {
    const docCount = documents.length;
    const termDocCount = new Map<string, number>();

    documents.forEach(doc => {
      const uniqueTerms = new Set(doc);
      uniqueTerms.forEach(term => {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      });
    });

    termDocCount.forEach((count, term) => {
      this.idf.set(term, Math.log(docCount / count));
    });
  }

  addDocuments(docs: string[]) {
    this.documents = docs;
    const tokenizedDocs = docs.map(d => this.tokenize(d));
    this.computeIDF(tokenizedDocs);
  }

  getVector(text: string): number[] {
    const tokens = this.tokenize(text);
    const tf = this.computeTF(tokens);
    const vector: number[] = [];

    const allTerms = Array.from(this.idf.keys());
    allTerms.forEach(term => {
      const tfValue = tf.get(term) || 0;
      const idfValue = this.idf.get(term) || 0;
      vector.push(tfValue * idfValue);
    });

    return vector;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    const len = Math.min(a.length, b.length);
    
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  hash(text: string): string {
    return crypto.createHash("md5").update(text).digest("hex").slice(0, 16);
  }
}

export const localEmbeddings = new LocalEmbeddings();