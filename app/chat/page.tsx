'use client';

// ─── Client perspective ────────────────────────────────────
// This page simulates the END-USER's WhatsApp window.
// YOU are the client chatting with "Nwealth Capital" (the bot).
//   direction: 'inbound'  → your message  → RIGHT side (green bubble)
//   direction: 'outbound' → bot reply     → LEFT side  (white bubble)

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ──────────────────────────────────────────────────

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at: string;
};

type Session = {
  conversationId: string;
  contactId: string;
  name: string;
};

// ─── Helpers ────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function TickIcon({ read }: { read: boolean }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ display: 'inline' }}>
      <path d="M1 5L4.5 8.5L9 3" stroke={read ? '#4fc3f7' : '#aaa'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5L8.5 8.5L13 3" stroke={read ? '#4fc3f7' : '#aaa'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Message bubble ──────────────────────────────────────────

function Bubble({ msg, isLast }: { msg: Message; isLast: boolean }) {
  const isUser = msg.direction === 'inbound';
  return (
    <div className={`flex mb-1 px-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="relative max-w-[72%] rounded-lg px-3 pt-2 pb-1 shadow-sm text-sm break-words"
        style={{
          backgroundColor: isUser ? '#d9fdd3' : '#ffffff',
          borderRadius: isUser
            ? '12px 12px 4px 12px'
            : '12px 12px 12px 4px',
        }}
      >
        <p className="whitespace-pre-wrap" style={{ color: '#111', lineHeight: 1.45 }}>
          {msg.body}
        </p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px]" style={{ color: '#888' }}>
            {formatTime(msg.created_at)}
          </span>
          {isUser && <TickIcon read={isLast} />}
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator ────────────────────────────────────────

function TypingBubble() {
  return (
    <div className="flex justify-start mb-2 px-3">
      <div
        className="px-4 py-3 rounded-lg shadow-sm flex gap-1 items-end"
        style={{ backgroundColor: '#fff', borderRadius: '12px 12px 12px 4px' }}
      >
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#aaa', animation: `typing-dot 1s ${delay}ms infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Name modal ──────────────────────────────────────────────

function NameModal({ onStart, error, loading }: { onStart: (name: string) => void; error?: string; loading?: boolean }) {
  const [name, setName] = useState('');
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
          <p className="text-xs text-gray-500 mt-1">Enter your name to start</p>
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
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && !loading && onStart(name.trim())}
          className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none mb-3 text-gray-900 placeholder-gray-400 bg-white"
          style={{ borderColor: '#e5e7eb' }}
          disabled={loading}
        />
        <button
          onClick={() => name.trim() && !loading && onStart(name.trim())}
          disabled={!name.trim() || loading}
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // ── Load or create session from localStorage ─────────────────
  useEffect(() => {
    const saved = localStorage.getItem('nwealth_session');
    if (saved) {
      try {
        const parsed: Session = JSON.parse(saved);
        setSession(parsed);
      } catch {
        setShowNameModal(true);
      }
    } else {
      setShowNameModal(true);
    }
  }, []);

  // ── Create a new session ─────────────────────────────────────
  const startSession = useCallback(async (name: string) => {
    setModalError('');
    setModalLoading(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setModalError(err?.error || `Server error (${res.status}). Check that Supabase is configured and schema is applied.`);
        setModalLoading(false);
        return;
      }
      const { contact, conversation } = await res.json();
      const newSession: Session = {
        conversationId: conversation.id,
        contactId: contact.id,
        name,
      };
      localStorage.setItem('nwealth_session', JSON.stringify(newSession));
      setShowNameModal(false);
      setSession(newSession);
      setMessages([]);
    } catch (e) {
      setModalError(`Could not reach server. Is the dev server running? (${String(e)})`);
      setModalLoading(false);
    }
  }, []);

  // ── Load messages + SSE when session is ready ────────────────
  useEffect(() => {
    if (!session) return;

    fetch(`/api/conversations/${session.conversationId}/messages`)
      .then((r) => r.json())
      .then((data: Message[]) => setMessages(data));

    sseRef.current?.close();
    const es = new EventSource(`/api/conversations/${session.conversationId}/stream`);
    sseRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'typing') {
        setIsTyping(true);
        return;
      }
      if (data.type === 'message') {
        setIsTyping(false);
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, { id: data.id, direction: data.direction, body: data.body, created_at: data.created_at }];
        });
      }
    };

    return () => es.close();
  }, [session]);

  // ── Auto-scroll ──────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!session || !inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);

    const optimisticId = uuidv4();
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, direction: 'inbound', body: text, created_at: new Date().toISOString() },
    ]);

    await fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: session.conversationId,
        contactId: session.contactId,
        phone: session.contactId,
        name: session.name,
        text,
        messageId: optimisticId,
      }),
    });

    setSending(false);
    inputRef.current?.focus();
  }, [session, inputText, sending]);

  // ── Reset session ────────────────────────────────────────────
  const resetSession = () => {
    sseRef.current?.close();
    localStorage.removeItem('nwealth_session');
    setSession(null);
    setMessages([]);
    setShowNameModal(true);
  };

  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        textarea:focus { outline: none; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
      `}</style>

      {/* ── Outer shell: centres the "phone" on desktop ──────── */}
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        <div
          className="flex flex-col shadow-2xl overflow-hidden"
          style={{
            width: '100%',
            maxWidth: 480,
            height: '100vh',
            maxHeight: 860,
            borderRadius: 12,
            backgroundColor: '#e5ddd5',
          }}
        >
          {/* ── WhatsApp-style header ───────────────────────── */}
          <div
            className="flex items-center gap-3 px-3 py-2"
            style={{ backgroundColor: '#0d3b33', flexShrink: 0 }}
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#1a7a6e' }}
            >
              N
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Nwealth Capital</p>
              <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {isTyping ? 'typing…' : 'Mutual fund distributor · Pune'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Link
                href="/kb"
                title="Knowledge Base"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-base"
              >
                📚
              </Link>
              <button
                onClick={resetSession}
                title="New conversation (switch user)"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white text-base"
              >
                ⟳
              </button>
            </div>
          </div>

          {/* ── Session pill ────────────────────────────────── */}
          {session && (
            <div className="flex justify-center py-2" style={{ flexShrink: 0 }}>
              <span
                className="text-[11px] px-3 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: '#555' }}
              >
                Chatting as {session.name} · dev mode
              </span>
            </div>
          )}

          {/* ── Messages area ────────────────────────────────── */}
          <div
            className="flex-1 overflow-y-auto py-2"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23e5ddd5'/%3E%3C/svg%3E")`,
            }}
          >
            {messages.length === 0 && !isTyping && session && (
              <div className="flex justify-center mt-6">
                <span
                  className="text-xs px-4 py-1.5 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.07)', color: '#555' }}
                >
                  Say hi to start the conversation
                </span>
              </div>
            )}

            {messages.map((msg, i) => (
              <Bubble key={msg.id} msg={msg} isLast={i === messages.length - 1 && msg.direction === 'inbound'} />
            ))}

            {isTyping && <TypingBubble />}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input bar ────────────────────────────────────── */}
          <div
            className="flex items-end gap-2 px-3 py-2"
            style={{ backgroundColor: '#f0ebe5', flexShrink: 0 }}
          >
            <div
              className="flex-1 rounded-2xl px-4 py-2 flex items-end"
              style={{ backgroundColor: '#fff', minHeight: 44, border: '1px solid #e5e0d8' }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Message"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="w-full resize-none bg-transparent text-sm"
                style={{ color: '#111', maxHeight: 110, lineHeight: '1.45' }}
                disabled={!session}
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || sending || !session}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all disabled:opacity-40"
              style={{ backgroundColor: '#0d3b33' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showNameModal && <NameModal onStart={startSession} error={modalError} loading={modalLoading} />}
    </>
  );
}
