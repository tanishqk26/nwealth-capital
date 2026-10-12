// GET  /api/kb/documents        — list all KB documents (for status polling)
// DELETE /api/kb/documents?id=  — delete a document from DB + Pinecone

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { deleteDocument } from '@/lib/rag';

export async function GET() {
  const { data, error } = await db
    .from('kb_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Remove vectors from Pinecone
  try {
    await deleteDocument(id);
  } catch (err) {
    console.warn('[kb/documents] Pinecone delete warning (continuing):', err);
  }

  const { error } = await db.from('kb_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
