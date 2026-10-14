'use client';

// Inbox-style split pane (same look as /inbox): contact list on the left, conversation on the right.
// Used by /chat (client talking to the Nwealth bot) and /assistant (staff talking to their assistant bot).

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type PhoneChatContact = {
  id: string;
  name: string;
  subtitle: string;
  avatar: string;        // 1–2 letters
  color: string;         // avatar background
  conversationId: string;
};

type Message = { id: string; direction: 'inbound' | 'outbound'; body: string; created_at: string };

type Props = {
  title: string;                       // list header, e.g. "Chats"
  userLabel: string;                   // "Chatting as Rahul"
  contacts: PhoneChatContact[];
  send: (contact: PhoneChatContact, text: string, messageId: string) => Promise<void>;
  placeholder?: string;
  emptyHint?: string;
  headerAction?: { label: string; title: string; onClick: () => void };
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Bubble({ msg }: { msg: Message }) {
  const mine = msg.direction === 'inbound';
  return (
    <div className={`flex mb-1 px-4 ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[70%] px-3 pt-2 pb-1 shadow-sm text-sm break-words"
        style={{ backgroundColor: mine ? '#d9fdd3' : '#fff', borderRadius: mine ? '12px 12px 4px 12px' : '12px 12px 12px 4px' }}
      >
        <p className="whitespace-pre-wrap" style={{ color: '#111', lineHeight: 1.45 }}>{msg.body}</p>
        <div className="text-right mt-0.5">
          <span className="text-[10px]" style={{ color: '#888' }}>{formatTime(msg.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start mb-2 px-3">
      <div className="px-4 py-3 shadow-sm flex gap-1 items-end" style={{ backgroundColor: '#fff', borderRadius: '12px 12px 12px 4px' }}>
        {[0, 160, 320].map((d) => (
          <span key={d} className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#aaa', animation: `typing-dot 1s ${d}ms infinite` }} />
        ))}
      </div>
    </div>
  );
}

export function PhoneChat({ title, userLabel, contacts, send, placeholder = 'Type a message…', emptyHint = 'Say hi to start', headerAction }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [byChat, setByChat] = useState<Record<string, Message[]>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const openRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The first contact is selected by default (like the inbox opening its first thread)
  const open = contacts.find((c) => c.id === selectedId) ?? contacts[0] ?? null;
  const openId = open?.id ?? null;
  useEffect(() => { openRef.current = openId; }, [openId]);

  // History + live stream for every contact (list previews + unread counts)
  const contactKey = contacts.map((c) => c.conversationId).join(',');
  useEffect(() => {
    const sources: EventSource[] = [];
    contacts.forEach((c) => {
      fetch(`/api/conversations/${c.conversationId}/messages`)
        .then((r) => r.json())
        .then((data: Message[]) => Array.isArray(data) && setByChat((p) => ({ ...p, [c.id]: data })))
        .catch(() => {});

      const es = new EventSource(`/api/conversations/${c.conversationId}/stream`);
      es.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type === 'typing') { setTyping((p) => ({ ...p, [c.id]: true })); return; }
        if (d.type !== 'message') return;
        setTyping((p) => ({ ...p, [c.id]: false }));
        setByChat((p) => {
          const list = p[c.id] ?? [];
          if (list.some((m) => m.id === d.id)) return p;
          return { ...p, [c.id]: [...list, { id: d.id, direction: d.direction, body: d.body, created_at: d.created_at }] };
        });
        if (d.direction === 'outbound' && openRef.current !== c.id) {
          setUnread((p) => ({ ...p, [c.id]: (p[c.id] ?? 0) + 1 }));
        }
      };
      sources.push(es);
    });
    return () => sources.forEach((s) => s.close());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey]);

  const msgs = open ? byChat[open.id] ?? [] : [];
  const openTyping = openId ? typing[openId] : false;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length, openTyping, openId]);

  const select = (id: string) => {
    setSelectedId(id);
    setMobileOpen(true);
    setUnread((p) => ({ ...p, [id]: 0 }));
  };

  const submit = useCallback(async () => {
    if (!open || !text.trim() || sending) return;
    const body = text.trim();
    const id = uuidv4();
    setText('');
    setSending(true);
    setByChat((p) => ({ ...p, [open.id]: [...(p[open.id] ?? []), { id, direction: 'inbound', body, created_at: new Date().toISOString() }] }));
    try {
      await send(open, body, id);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [open, text, sending, send]);

  const filtered = contacts.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  // group messages by day
  const grouped: { day: string; items: Message[] }[] = [];
  msgs.forEach((m) => {
    const day = dayLabel(m.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.items.push(m);
    else grouped.push({ day, items: [m] });
  });

  return (
    <>
      <style>{`
        @keyframes typing-dot { 0%,60%,100% { transform: translateY(0); opacity:.4 } 30% { transform: translateY(-4px); opacity:1 } }
      `}</style>
      <div className="flex h-screen overflow-hidden bg-white">

        {/* ── Left pane ─────────────────────────────────────── */}
        <div className={`${mobileOpen ? 'hidden md:flex' : 'flex'} flex-col flex-shrink-0 border-r border-gray-200 w-full md:w-80`}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ backgroundColor: '#0d3b33', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-white font-semibold text-sm">{title}</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{userLabel}</p>
            </div>
            {headerAction && (
              <button onClick={headerAction.onClick} title={headerAction.title} className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {headerAction.label}
              </button>
            )}
          </div>

          <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#f5f5f5' }}>
              <input
                type="text"
                placeholder="Search in chats"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="flex items-center justify-center h-full"><p className="text-xs text-gray-400">No chats</p></div>
            )}
            {filtered.map((c) => {
              const list = byChat[c.id] ?? [];
              const last = list[list.length - 1];
              const n = unread[c.id] ?? 0;
              const active = c.id === openId;
              return (
                <button key={c.id} onClick={() => select(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ borderBottom: '1px solid #f5f5f5', backgroundColor: active ? '#f0f4f3' : 'transparent' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: c.color }}>
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-semibold text-sm text-gray-800 truncate">{c.name}</p>
                      {last && <span className="text-[11px] ml-2 text-gray-400">{formatTime(last.created_at)}</span>}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs truncate text-gray-500">
                        {typing[c.id] ? 'typing…' : last ? `${last.direction === 'inbound' ? 'You: ' : ''}${last.body}` : c.subtitle}
                      </p>
                      {n > 0 && (
                        <span className="ml-2 text-[10px] font-bold text-white rounded-full px-1.5 min-w-[18px] text-center" style={{ backgroundColor: '#0d3b33' }}>{n}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 text-[10px] text-gray-400 flex-shrink-0" style={{ borderTop: '1px solid #f0f0f0' }}>
            {filtered.length} chat{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Right pane ────────────────────────────────────── */}
        {!open ? (
          <div className="flex-1 hidden md:flex items-center justify-center text-sm text-gray-400" style={{ backgroundColor: '#f8f8f6' }}>
            Loading…
          </div>
        ) : (
          <div className={`${mobileOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 bg-white" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <button onClick={() => setMobileOpen(false)} className="md:hidden text-gray-600 text-lg" aria-label="Back">←</button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: open.color }}>
                {open.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{open.name}</p>
                <p className="text-xs text-gray-400">{openTyping ? 'typing…' : open.subtitle}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4" style={{ backgroundColor: '#e5ddd5' }}>
              {msgs.length === 0 && !openTyping && (
                <div className="flex justify-center mt-6 px-4">
                  <span className="text-xs px-4 py-1.5 rounded-full text-center" style={{ backgroundColor: 'rgba(0,0,0,0.07)', color: '#555' }}>{emptyHint}</span>
                </div>
              )}
              {grouped.map(({ day, items }) => (
                <div key={day}>
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: '#555' }}>{day}</span>
                  </div>
                  {items.map((m) => <Bubble key={m.id} msg={m} />)}
                </div>
              ))}
              {openTyping && <Typing />}
              <div ref={endRef} />
            </div>

            <div className="flex items-end gap-3 px-4 py-3 flex-shrink-0 bg-white" style={{ borderTop: '1px solid #e5e7eb' }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder={placeholder}
                className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-gray-50 outline-none"
                style={{ border: '1px solid #e5e7eb', maxHeight: 120 }}
              />
              <button onClick={submit} disabled={!text.trim() || sending}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                style={{ backgroundColor: '#0d3b33' }} aria-label="Send">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
