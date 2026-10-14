'use client';

// ─── Staff perspective ─────────────────────────────────────
// The admin's / salesperson's own WhatsApp-style chat with the Nwealth Assistant bot.
// Tell it about meetings and to-dos; it creates reminders and pings you here when they are due.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneChat, type PhoneChatContact } from '@/app/components/PhoneChat';

type Session = { conversationId: string; name: string; role: string };

export default function AssistantPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/assistant/session')
      .then(async (r) => {
        if (r.status === 401) { router.replace('/login?from=/assistant'); return; }
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        setSession(await r.json());
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [router]);

  const contacts: PhoneChatContact[] = useMemo(
    () => session
      ? [{
          id: 'assistant',
          name: 'Nwealth Assistant',
          subtitle: 'Your reminders & schedule',
          avatar: 'A',
          color: '#b45309',
          conversationId: session.conversationId,
        }]
      : [],
    [session]
  );

  const send = useCallback(async (_c: PhoneChatContact, text: string) => {
    await fetch('/api/assistant/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }, []);

  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!session) return <p className="p-8 text-sm text-gray-500">Loading…</p>;

  return (
    <PhoneChat
      title="Assistant"
      userLabel={`${session.name} · ${session.role}`}
      contacts={contacts}
      send={send}
      placeholder="e.g. Tomorrow 5pm meeting with Rahul Sharma, remind me"
      emptyHint="Try: “Tomorrow is a meeting with client Xyz to review their portfolio — remind me”"
      headerAction={{ label: '← Dashboard', title: 'Back to dashboard', onClick: () => router.push('/dashboard') }}
    />
  );
}
