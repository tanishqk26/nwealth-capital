import { db, getOrCreateConversation, saveMessage, type Message } from './supabase';
import { emit } from './sse';

// Every staff member (and the admin) has a private chat with the assistant bot.
// It is stored like any conversation, on a contact with type = 'staff'.
export type StaffIdentity = { role: 'admin' | 'salesperson'; memberId: string | null; name: string };

export function staffPhone(staff: Pick<StaffIdentity, 'memberId'>) {
  return `staff:${staff.memberId ?? 'admin'}`;
}

export async function getStaffConversation(staff: StaffIdentity) {
  const phone = staffPhone(staff);
  let { data: contact } = await db.from('contacts').select('id').eq('phone', phone).single();
  if (!contact) {
    const { data, error } = await db
      .from('contacts')
      .insert({ phone, name: staff.name, type: 'staff', source: 'assistant' })
      .select('id')
      .single();
    if (error || !data) throw new Error(`Failed to create staff contact: ${error?.message}`);
    contact = data;
  }
  const conversation = await getOrCreateConversation(contact.id);
  return { contactId: contact.id as string, conversationId: conversation.id as string };
}

// Post a bot message into a staff member's assistant chat and push it live.
export async function postAssistantMessage(conversationId: string, body: string): Promise<Message> {
  const msg = await saveMessage(conversationId, 'outbound', body);
  emit(conversationId, { type: 'message', direction: 'outbound', id: msg.id, body, created_at: msg.created_at });
  return msg;
}
