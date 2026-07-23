import { db, type Note } from '../db';

type FeatureExtractionPipeline = (text: string, options?: { pooling?: string; normalize?: boolean }) => Promise<{ data: Float32Array | number[] }>;
let embedder: FeatureExtractionPipeline | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transformersModule: any = null;
let useFallback = false;
const FALLBACK_DIM = 384;

// --- Fallback TF-IDF Embedding (pure JS, no WASM needed) ---

const tokenize = (text: string): string[] => text.toLowerCase().match(/\b\w+\b/g) || [];

const hashToken = (token: string): number => {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % FALLBACK_DIM;
};

const tfidfEmbed = (tokens: string[]): number[] => {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const total = tokens.length || 1;

  const vec = new Array(FALLBACK_DIM).fill(0);
  for (const [token, count] of Object.entries(tf)) {
    const weight = (count / total) * (1 + Math.log(1 + count));
    vec[hashToken(token)] += weight;
  }

  // Normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
};

// --- Transformer Embedding (requires WASM) ---

const initTransformer = async (): Promise<FeatureExtractionPipeline | null> => {
  try {
    if (!transformersModule) {
      transformersModule = await import('@xenova/transformers');
      transformersModule.env.allowLocalModels = false;
      transformersModule.env.useBrowserCache = false;
    }
    const pipe = await transformersModule.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as unknown as FeatureExtractionPipeline;
    return pipe;
  } catch (e) {
    console.warn('Transformer WASM unavailable, using TF-IDF fallback:', e);
    useFallback = true;
    return null;
  }
};

export const initEmbedder = async () => {
  if (useFallback) return null;
  if (!embedder) {
    embedder = await initTransformer();
  }
  return embedder;
};

// Generate an embedding for a string
export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (useFallback) return tfidfEmbed(tokenize(text));

  const e = await initEmbedder();
  if (!e) return tfidfEmbed(tokenize(text));

  try {
    const output = await e(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch {
    // Transformer failed at runtime, switch to fallback permanently
    useFallback = true;
    console.warn('Transformer failed at runtime, switching to TF-IDF fallback');
    return tfidfEmbed(tokenize(text));
  }
};

// Cosine similarity
export const cosineSimilarity = (a: number[], b: number[]) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Re-embed all notes that are missing embeddings
export const reindexNotes = async (onProgress?: (msg: string) => void) => {
  const notes = await db.notes.toArray();
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (!note.embedding) {
      if (onProgress) onProgress(`Indexing ${i + 1}/${notes.length}: ${note.title}`);
      const text = `${note.title}\n\n${note.content}`;
      const embedding = await generateEmbedding(text);
      await db.notes.update(note.id!, { embedding });
    }
  }
  if (onProgress) onProgress('Indexing complete!');
};

// Semantic Search
export const semanticSearch = async (query: string, limit: number = 5): Promise<Array<Note & { score: number }>> => {
  const queryEmbedding = await generateEmbedding(query);
  const notes = await db.notes.toArray();

  const results = notes
    .filter(n => n.embedding)
    .map(n => ({
      ...n,
      score: cosineSimilarity(queryEmbedding, n.embedding!)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
};

// AI Graph Clustering (Local Semantic Clustering)
export const clusterUnlinkedNotes = async (onProgress?: (msg: string) => void) => {
  // First ensure all notes have embeddings
  await reindexNotes(onProgress);

  const notes = await db.notes.toArray();
  // Find nodes with no links (we consider links where source or target is this node)
  const links = await db.links.toArray();
  const linkedIds = new Set(links.flatMap(l => [l.sourceId, l.targetId]));

  const unlinkedNotes = notes.filter(n => !linkedIds.has(n.id!));

  if (onProgress) onProgress(`Clustering ${unlinkedNotes.length} unlinked notes...`);

  let newLinks = 0;
  for (const source of unlinkedNotes) {
    if (!source.embedding) continue;

    let bestMatch: Note | null = null;
    let bestScore = -1;

    for (const target of notes) {
      if (source.id === target.id || !target.embedding) continue;

      const score = cosineSimilarity(source.embedding, target.embedding);
      if (score > bestScore && score > 0.6) { // 0.6 threshold for similarity
        bestScore = score;
        bestMatch = target;
      }
    }

    if (bestMatch && source.id && bestMatch.id) {
      // Create a link
      const linkExists = await db.links.where({ sourceId: source.id, targetId: bestMatch.id }).first() ||
                         await db.links.where({ sourceId: bestMatch.id, targetId: source.id }).first();

      if (!linkExists) {
        await db.links.add({ sourceId: source.id, targetId: bestMatch.id });
        newLinks++;
      }
    }
  }

  if (onProgress) onProgress(`Clustering complete! Found ${newLinks} new semantic links.`);
};
