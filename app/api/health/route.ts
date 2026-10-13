export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET() {
  const checks: Record<string, string> = {};

  // Env vars
  checks.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ set' : '❌ MISSING';
  checks.service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ set' : '❌ MISSING';
  checks.gemini_api_key = process.env.GEMINI_API_KEY ? '✅ set' : '❌ MISSING';
  checks.pinecone_api_key = process.env.PINECONE_API_KEY ? '✅ set' : '⚠️ not set (RAG disabled)';

  // DB connectivity
  try {
    const { error } = await db.from('conversations').select('id').limit(1);
    checks.db_conversations = error ? `❌ ${error.message}` : '✅ reachable';
  } catch (e) {
    checks.db_conversations = `❌ ${String(e)}`;
  }

  try {
    const { error } = await db.from('contacts').select('id').limit(1);
    checks.db_contacts = error ? `❌ ${error.message}` : '✅ reachable';
  } catch (e) {
    checks.db_contacts = `❌ ${String(e)}`;
  }

  try {
    const { error } = await db.from('kb_documents').select('id').limit(1);
    checks.db_kb_documents = error ? `❌ ${error.message}` : '✅ reachable';
  } catch (e) {
    checks.db_kb_documents = `❌ ${String(e)}`;
  }

  // List Gemini models that support embedContent
  try {
    const key = process.env.GEMINI_API_KEY;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`,
    );
    if (res.ok) {
      const { models } = await res.json() as { models: { name: string; supportedGenerationMethods: string[] }[] };
      const embedModels = models
        .filter((m) => m.supportedGenerationMethods?.includes('embedContent'))
        .map((m) => m.name);
      checks.gemini_embed_models = embedModels.length
        ? `✅ ${embedModels.join(', ')}`
        : '❌ none found';
    } else {
      checks.gemini_embed_models = `❌ list failed (${res.status})`;
    }
  } catch (e) {
    checks.gemini_embed_models = `❌ ${String(e)}`;
  }

  const allOk = Object.values(checks).every((v) => v.startsWith('✅') || v.startsWith('⚠️'));
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
