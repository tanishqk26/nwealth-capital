import { db } from './supabase';
import { postAssistantMessage, getStaffConversation, type StaffIdentity } from './staff-chat';

// Delivers due reminders into the assignee's assistant chat. Safe to call repeatedly:
// a task is claimed by setting reminded_at before the message is sent.
export async function runDueReminders(): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await db
    .from('tasks')
    .select('id, title, due_at, assignee_id, contact:contacts(name)')
    .eq('status', 'open')
    .is('reminded_at', null)
    .not('remind_at', 'is', null)
    .lte('remind_at', nowIso)
    .order('remind_at', { ascending: true })
    .limit(50);

  if (error || !due?.length) return 0;

  const team: Record<string, string> = {};
  const ids = [...new Set(due.map((t) => t.assignee_id).filter(Boolean))] as string[];
  if (ids.length) {
    const { data } = await db.from('team_members').select('id, name').in('id', ids);
    data?.forEach((m) => { team[m.id] = m.name; });
  }

  let sent = 0;
  for (const t of due) {
    // claim first so overlapping ticks can't double-send
    const { data: claimed } = await db
      .from('tasks')
      .update({ reminded_at: nowIso })
      .eq('id', t.id)
      .is('reminded_at', null)
      .select('id');
    if (!claimed?.length) continue;

    const staff: StaffIdentity = t.assignee_id
      ? { role: 'salesperson', memberId: t.assignee_id, name: team[t.assignee_id] ?? 'Team member' }
      : { role: 'admin', memberId: null, name: 'Admin' };

    const when = t.due_at
      ? new Date(t.due_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
      : '';
    const contact = t.contact as { name?: string } | { name?: string }[] | null;
    const client = Array.isArray(contact) ? contact[0]?.name : contact?.name;

    try {
      const { conversationId } = await getStaffConversation(staff);
      await postAssistantMessage(
        conversationId,
        `⏰ Reminder: ${t.title}${when ? `\n🕒 ${when}` : ''}${client ? `\n👤 ${client}` : ''}\n\nReply "done ${t.title.split(' ').slice(0, 3).join(' ')}" when finished.`
      );
      sent++;
    } catch (err) {
      console.error('[reminders] delivery failed, releasing task:', err);
      await db.from('tasks').update({ reminded_at: null }).eq('id', t.id);
    }
  }
  return sent;
}
