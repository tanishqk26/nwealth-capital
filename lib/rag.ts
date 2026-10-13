// ─── RAG: embedding + Pinecone ────────────────────────────
// Embedding model: gemini-embedding-001 → 768 dimensions
// Make sure your Pinecone index is created with 768 dimensions.
// Pinecone dashboard: https://app.pinecone.io → your index → dimensions = 768

import { Pinecone } from '@pinecone-database/pinecone';

const EMBEDDING_MODEL = 'gemini-embedding-2-preview'; // supports outputDimensionality
const EMBEDDING_DIM = 1024; // matches existing Pinecone index
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

const CHUNK_CHARS = 900;   // ~200-250 tokens per chunk
const OVERLAP_CHARS = 120; // overlap between consecutive chunks
const MIN_SCORE = 0.65;    // minimum cosine similarity for a result to be included

function getPinecone() {
  if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY not set');
  if (!process.env.PINECONE_INDEX_NAME) throw new Error('PINECONE_INDEX_NAME not set');
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

// ─── Embed a single string (direct REST call to v1 endpoint) ─

export async function embedText(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const url = `${EMBED_URL}?key=${process.env.GEMINI_API_KEY}`;
  const body = JSON.stringify({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIM,
  });

  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.ok) {
      const data = await res.json() as { embedding: { values: number[] } };
      return data.embedding.values;
    }

    lastErr = await res.text();
    // Only retry on 429 (rate limit) or 5xx (server errors)
    if (res.status < 429) break;
  }

  throw new Error(`Embedding API failed after retries: ${lastErr}`);
}

// ─── Chunk text with overlap ──────────────────────────────

export function chunkText(text: string): string[] {
  // Normalise whitespace
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + CHUNK_CHARS, clean.length);
    // Try to break at a sentence boundary within the last 200 chars
    let splitAt = end;
    if (end < clean.length) {
      const window = clean.slice(Math.max(end - 200, start), end);
      const lastPeriod = window.lastIndexOf('. ');
      if (lastPeriod !== -1) {
        splitAt = Math.max(end - 200, start) + lastPeriod + 2;
      }
    }
    const chunk = clean.slice(start, splitAt).trim();
    if (chunk.length > 40) chunks.push(chunk);
    start = Math.max(splitAt - OVERLAP_CHARS, start + 1);
  }

  return chunks;
}

// ─── Extract text from uploaded file ─────────────────────

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    // Dynamic import avoids CJS/ESM issues at build time
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${mimeType}. Upload a PDF or plain-text file.`);
}

// ─── Ingest a document into Pinecone ─────────────────────
// Returns the number of chunks indexed.

export async function ingestDocument(
  documentId: string,
  filename: string,
  text: string,
  onProgress?: (message: string) => void
): Promise<number> {
  const pinecone = getPinecone();
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

  const chunks = chunkText(text);
  onProgress?.(`Chunked into ${chunks.length} pieces — generating embeddings…`);

  // Embed in batches of 10 to avoid rate limits
  const vectors: { id: string; values: number[]; metadata: Record<string, string | number> }[] = [];
  const batchSize = 10;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map((c) => embedText(c)));
    for (let j = 0; j < batch.length; j++) {
      vectors.push({
        id: `${documentId}-chunk-${i + j}`,
        values: embeddings[j],
        metadata: {
          documentId,
          filename,
          chunkIndex: i + j,
          text: batch[j],
        },
      });
    }
    onProgress?.(`Embedded ${Math.min(i + batchSize, chunks.length)} / ${chunks.length} chunks…`);
  }

  // Upsert to Pinecone in batches of 100
  const upsertBatch = 100;
  for (let i = 0; i < vectors.length; i += upsertBatch) {
    await index.upsert(vectors.slice(i, i + upsertBatch));
  }

  return vectors.length;
}

// ─── Delete a document's vectors from Pinecone ───────────

export async function deleteDocument(documentId: string): Promise<void> {
  const pinecone = getPinecone();
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);
  // Pinecone serverless supports delete by metadata filter
  await index.deleteMany({ documentId });
}

// ─── Search for relevant FAQ chunks ──────────────────────
// Returns an array of matching text chunks, most relevant first.

export async function searchFAQ(query: string, topK = 5): Promise<string[]> {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) return [];

  try {
    const pinecone = getPinecone();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    const queryEmbedding = await embedText(query);
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return results.matches
      .filter((m) => (m.score ?? 0) >= MIN_SCORE)
      .map((m) => String(m.metadata?.text ?? ''))
      .filter(Boolean);
  } catch (err) {
    console.error('[rag] searchFAQ error:', err);
    return [];
  }
}
