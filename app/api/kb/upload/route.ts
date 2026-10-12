// POST /api/kb/upload
// Accepts a multipart/form-data with a single "file" field (PDF or TXT).
// 1. Saves metadata to Supabase with status = 'processing'
// 2. Returns immediately (202)
// 3. Runs extraction + embedding in the background
// 4. Updates status to 'embedding' → 'ready' (or 'error')

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { extractText, ingestDocument } from '@/lib/rag';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/csv'];

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 });
  }

  // Accept text/* broadly even if browser sends a more specific MIME type
  const mimeType = file.type || 'text/plain';
  const isAllowed = ALLOWED_TYPES.some((t) => mimeType.startsWith(t.split('/')[0]) && mimeType.includes(t.split('/')[1])) || mimeType === 'application/pdf';
  if (!isAllowed) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Upload PDF or TXT.` },
      { status: 415 }
    );
  }

  // ── Create DB record ────────────────────────────────────────
  const { data: doc, error: dbErr } = await db
    .from('kb_documents')
    .insert({
      filename: file.name,
      file_size: file.size,
      file_type: mimeType,
      status: 'processing',
    })
    .select()
    .single();

  if (dbErr || !doc) {
    return NextResponse.json({ error: dbErr?.message ?? 'DB error' }, { status: 500 });
  }

  // ── Read file bytes now (stream is consumed after request ends) ─
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── Background pipeline ─────────────────────────────────────
  setImmediate(async () => {
    try {
      // Step 1: extract text
      const text = await extractText(buffer, mimeType);

      if (!text.trim()) {
        await db
          .from('kb_documents')
          .update({ status: 'error', error_message: 'No text could be extracted from this file.', updated_at: new Date().toISOString() })
          .eq('id', doc.id);
        return;
      }

      // Step 2: start embedding
      await db
        .from('kb_documents')
        .update({ status: 'embedding', updated_at: new Date().toISOString() })
        .eq('id', doc.id);

      // Step 3: ingest into Pinecone
      const chunkCount = await ingestDocument(doc.id, file.name, text);

      // Step 4: mark ready
      await db
        .from('kb_documents')
        .update({ status: 'ready', chunk_count: chunkCount, updated_at: new Date().toISOString() })
        .eq('id', doc.id);
    } catch (err) {
      console.error('[kb/upload] pipeline error:', err);
      await db
        .from('kb_documents')
        .update({
          status: 'error',
          error_message: String(err instanceof Error ? err.message : err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);
    }
  });

  return NextResponse.json({ documentId: doc.id, status: 'processing' }, { status: 202 });
}
