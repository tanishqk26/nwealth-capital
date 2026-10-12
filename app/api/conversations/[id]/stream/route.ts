// GET /api/conversations/[id]/stream
// Server-Sent Events stream — pushes bot typing + messages to the dev UI in real time.
// Uses the module-level EventEmitter in lib/sse.ts (works in Next.js single-process dev).
// For production/serverless: replace with Supabase Realtime subscriptions.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import sseEmitter from '@/lib/sse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      );

      const handler = (event: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream already closed — ignore
        }
      };

      sseEmitter.on(conversationId, handler);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        sseEmitter.off(conversationId, handler);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
