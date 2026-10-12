import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service-role client for server-side use only — bypasses RLS.
// Never expose this client or the service role key to the browser.
export const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ─── Types matching schema.sql ──────────────────────────────

export type Contact = {
  id: string;
  phone: string | null;
  name: string | null;
  type: string;
  language: string;
  source: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  contact_id: string;
  status: string;
  last_message_at: string;
  created_at: string;
  contact?: Contact;
};

export type Message = {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  message_type: string;
  created_at: string;
};

export type Lead = {
  id: string;
  contact_id: string;
  conversation_id: string;
  intent: string | null;
  amount_range: string | null;
  callback_time: string | null;
  status: string;
  created_at: string;
};

// ─── Helpers ────────────────────────────────────────────────

export async function getOrCreateContact(phone: string, name?: string): Promise<Contact> {
  const { data: existing } = await db
    .from('contacts')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existing) return existing as Contact;

  const { data, error } = await db
    .from('contacts')
    .insert({ phone, name: name ?? phone, source: 'dev_ui' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create contact: ${error.message}`);
  return data as Contact;
}

export async function getOrCreateConversation(contactId: string): Promise<Conversation> {
  const { data: existing } = await db
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .eq('status', 'bot')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing as Conversation;

  const { data, error } = await db
    .from('conversations')
    .insert({ contact_id: contactId, status: 'bot' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data as Conversation;
}

export async function saveMessage(
  conversationId: string,
  direction: 'inbound' | 'outbound',
  body: string
): Promise<Message> {
  const { data, error } = await db
    .from('messages')
    .insert({ conversation_id: conversationId, direction, body })
    .select()
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  // Update last_message_at on the conversation
  await db
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export async function getRecentMessages(conversationId: string, limit = 20): Promise<Message[]> {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data as Message[]).reverse();
}
