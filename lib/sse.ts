import { EventEmitter } from 'events';

// Module-level singleton — works in Next.js dev (single Node.js process).
// For production/serverless: replace with Supabase Realtime or Redis pub/sub.
const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(200);

export default sseEmitter;

export type SSEEvent =
  | { type: 'connected' }
  | { type: 'typing' }
  | { type: 'message'; direction: 'inbound' | 'outbound'; id: string; body: string; created_at: string }
  | { type: 'status'; status: string };

export function emit(conversationId: string, event: SSEEvent) {
  sseEmitter.emit(conversationId, event);
}
