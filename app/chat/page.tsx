'use client';

// ─── Client perspective ────────────────────────────────────
// Simulates the END-USER's WhatsApp app: a chat list with the "Nwealth Capital" bot as a contact.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PhoneChat, type PhoneChatContact } from '@/app/components/PhoneChat';

type Session = { conversationId: string; contactId: string; name: string };

// ─── Name modal ──────────────────────────────────────────────

function NameModal({
  onStart,
  error,
  loading,
}: {
  onStart: (name: string, phone: string) => void;
  error?: string;
  loading?: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const phoneDigits = phone.replace(/\D/g, '');
  const canSubmit = name.trim() && phoneDigits.length >= 10 && !loading;
  const submit = () => canSubmit && onStart(name.trim(), phone.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="rounded-2xl shadow-2xl p-6 w-80 bg-white">
        <div className="text-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white mx-auto mb-3"
            style={{ backgroundColor: '#0d3b33' }}
          >N</div>
          <p className="font-semibold text-gray-800">Chat with Nwealth Capital</p>
          <p className="text-xs text-gray-500 mt-1">Enter your details to start</p>
        </div>
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}
        <input
          autoFocus
          type="text"
          placeholder="Your name (e.g. Rahul Sharma)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none mb-3 text-gray-900 placeholder-gray-400 bg-white"
          style={{ borderColor: '#e5e7eb' }}
          disabled={loading}
        />
        <input
          type="tel"
          placeholder="Phone number (e.g. +91 98765 43210)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none mb-3 text-gray-900 placeholder-gray-400 bg-white"
          style={{ borderColor: '#e5e7eb' }}
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#0d3b33' }}
        >
          {loading ? 'Starting…' : 'Start chatting'}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function ChatPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    // Restore saved session (localStorage is only readable on the client)
    const t = setTimeout(() => {
      const saved = localStorage.getItem('nwealth_session');
      if (saved) {
        try { setSession(JSON.parse(saved) as Session); return; } catch { /* fall through */ }
      }
      setShowNameModal(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const startSession = useCallback(async (name: string, phone: string) => {
    setModalError('');
    setModalLoading(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setModalError(err?.error || `Server error (${res.status}). Check that Supabase is configured and schema is applied.`);
        setModalLoading(false);
        return;
      }
      const { contact, conversation } = await res.json();
      const next: Session = { conversationId: conversation.id, contactId: contact.id, name };
      localStorage.setItem('nwealth_session', JSON.stringify(next));
      setShowNameModal(false);
      setModalLoading(false);
      setSession(next);
    } catch (e) {
      setModalError(`Could not reach server. Is the dev server running? (${String(e)})`);
      setModalLoading(false);
    }
  }, []);

  const contacts: PhoneChatContact[] = useMemo(
    () => session
      ? [{
          id: 'nwealth-bot',
          name: 'Nwealth Capital',
          subtitle: 'Mutual fund distributor · Pune',
          avatar: 'N',
          color: '#1a7a6e',
          conversationId: session.conversationId,
        }]
      : [],
    [session]
  );

  const sendToBot = useCallback(async (_c: PhoneChatContact, text: string, messageId: string) => {
    if (!session) return;
    await fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: session.conversationId,
        contactId: session.contactId,
        phone: session.contactId,
        name: session.name,
        text,
        messageId,
      }),
    });
  }, [session]);

  const switchUser = () => {
    localStorage.removeItem('nwealth_session');
    setSession(null);
    setShowNameModal(true);
  };

  return (
    <>
      {session && (
        <PhoneChat
          title="Chats"
          userLabel={`${session.name} · dev mode`}
          contacts={contacts}
          send={sendToBot}
          emptyHint="Say hi to start the conversation"
          headerAction={{ label: 'Switch user', title: 'New conversation (switch user)', onClick: switchUser }}
        />
      )}
      {showNameModal && <NameModal onStart={startSession} error={modalError} loading={modalLoading} />}
    </>
  );
}
