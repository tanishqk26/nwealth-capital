'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  IconSearch, IconAlertCircle, IconMessage,
} from '@/app/dashboard/components/Icons';

// ── Types ────────────────────────────────────────────────────────

type Contact = { id: string; name: string; phone: string };
type LastMsg  = { body: string; direction: string; created_at: string };
type Conv = {
  id: string;
  status: 'bot' | 'handoff' | 'closed';
  handoff_reason: string | null;
  handoff_summary: string | null;
  last_message_at: string;
  created_at: string;
  contacts: Contact;
  last_message: LastMsg | null;
};
type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at: string;
  sender?: string;
};

// ── Helpers ──────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return (name ?? '?')[0].toUpperCase();
}

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  bot:     { label: 'Bot',     bg: '#f3f4f6', text: '#374151' },
  handoff: { label: 'Handoff', bg: '#fef3c7', text: '#92400e' },
  closed:  { label: 'Closed',  bg: '#d1fae5', text: '#065f46' },
};

// ── Icons ────────────────────────────────────────────────────────

function IconSend({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Conversation row ─────────────────────────────────────────────

function ConvRow({
  conv, selected, onClick,
}: { conv: Conv; selected: boolean; onClick: () => void }) {
  const badge = STATUS[conv.status] ?? STATUS.bot;
  const preview = conv.last_message?.body ?? '';
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-b"
      style={{
        backgroundColor: selected ? '#f0faf8' : 'transparent',
        borderColor: '#f0f0f0',
        borderLeft: conv.status === 'handoff' ? '3px solid #f59e0b' : '3px solid transparent',
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
        style={{ backgroundColor: '#1a7a6e' }}
      >
        {initials(conv.contacts?.name ?? '?')}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {conv.contacts?.name ?? conv.contacts?.phone ?? 'Unknown'}
          </p>
          <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
            {relTime(conv.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-gray-500 truncate flex-1">
            {preview || <span className="text-gray-300 italic">No messages yet</span>}
          </p>
          {conv.status === 'handoff' && (
            <span
              className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
            >
              !
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Bubble ───────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.direction === 'inbound';
  const isAgent = msg.direction === 'outbound' && msg.sender === 'agent';
  return (
    <div className={`flex mb-1.5 px-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[72%]">
        {!isUser && (
          <span className="text-[10px] mb-0.5 ml-1" style={{ color: isAgent ? '#b45309' : '#6b7280' }}>
            {isAgent ? 'Agent' : 'Bot'}
          </span>
        )}
        <div
          className="rounded-lg px-3 pt-2 pb-1 shadow-sm text-sm break-words"
          style={{
            backgroundColor: isUser ? '#d9fdd3' : '#ffffff',
            borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          }}
        >
          <p className="whitespace-pre-wrap" style={{ color: '#111', lineHeight: 1.45 }}>
            {msg.body}
          </p>
          <p className="text-right text-[10px] mt-0.5" style={{ color: '#a0a0a0' }}>
            {msgTime(msg.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#e5ddd5' }}>
      <div className="text-center" style={{ opacity: 0.5 }}>
        <IconMessage size={40} />
        <p className="text-sm text-gray-600 mt-3">Select a conversation</p>
      </div>
    </div>
  );
}

// ── Main inbox ───────────────────────────────────────────────────

type Tab = 'all' | 'bot' | 'handoff' | 'closed';

function InboxContent() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Load conversations
  const loadConvs = useCallback(() => {
    fetch('/api/dashboard/conversations')
      .then((r) => r.json())
      .then((data) => { setConvs(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    loadConvs();
    const interval = setInterval(loadConvs, 30000);
    return () => clearInterval(interval);
  }, [loadConvs]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setMsgLoading(true);
    fetch(`/api/dashboard/conversations/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data?.messages ?? []);
        setMsgLoading(false);
      });
  }, [selectedId]);

  // SSE for live bot replies
  useEffect(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (!selectedId) return;

    const es = new EventSource(`/api/conversations/${selectedId}/stream`);
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === 'message') {
          // SSE events are flat ({id, direction, body, created_at, sender?}); bot replies carry no sender
          const incoming = ev.message ?? { ...ev, sender: ev.sender ?? (ev.direction === 'outbound' ? 'bot' : 'customer') };
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          // Refresh conv list to update preview
          loadConvs();
        }
      } catch { /* ignore */ }
    };

    return () => { es.close(); sseRef.current = null; };
  }, [selectedId, loadConvs]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConv = convs.find((c) => c.id === selectedId) ?? null;

  // Filtered list
  const filtered = convs.filter((c) => {
    if (tab !== 'all' && c.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.contacts?.name?.toLowerCase().includes(q) ||
        c.contacts?.phone?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handoffCount = convs.filter((c) => c.status === 'handoff').length;

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const d = dayLabel(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last?.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  }

  // Send staff reply
  const sendReply = async () => {
    if (!replyText.trim() || !selectedId || sending) return;
    const text = replyText.trim();
    setReplyText('');
    setSending(true);
    try {
      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, text }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        loadConvs();
      }
    } finally {
      setSending(false);
    }
  };

  // Update conversation status
  const updateStatus = async (status: string) => {
    if (!selectedId || statusUpdating) return;
    setStatusUpdating(true);
    try {
      await fetch(`/api/dashboard/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadConvs();
    } finally {
      setStatusUpdating(false);
    }
  };

  const canReply = selectedConv?.status === 'handoff';
  const outside24h = selectedConv
    ? Date.now() - new Date(selectedConv.last_message_at).getTime() > 86400000
    : false;

  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ── Left pane ─────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-gray-200"
        style={{ width: 320 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ backgroundColor: '#0d3b33', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-sm">WhatsApp Inbox</p>
            {handoffCount > 0 && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: '#f59e0b', minWidth: 18, textAlign: 'center' }}
              >
                {handoffCount}
              </span>
            )}
          </div>
          <Link
            href="/dashboard"
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Dashboard
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#f5f5f5' }}>
            <IconSearch size={14} />
            <input
              type="text"
              placeholder="Search in chats"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
          {(['all', 'bot', 'handoff', 'closed'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
              style={{
                backgroundColor: tab === t ? '#0d3b33' : 'transparent',
                color: tab === t ? '#fff' : '#9ca3af',
              }}
            >
              {t === 'all' ? 'All' : t === 'handoff' ? 'Handoff' : t === 'bot' ? 'Bot' : 'Closed'}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-gray-400">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-gray-400">No conversations</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConvRow
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>

        {/* Footer count */}
        {!loading && (
          <div
            className="px-4 py-2 text-[10px] text-gray-400 flex-shrink-0"
            style={{ borderTop: '1px solid #f0f0f0' }}
          >
            {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Right pane ────────────────────────────────────────── */}
      {!selectedConv ? (
        <EmptyState />
      ) : (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Chat header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0 bg-white"
            style={{ borderBottom: '1px solid #e5e7eb' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#1a7a6e' }}
            >
              {initials(selectedConv.contacts?.name ?? '?')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">
                {selectedConv.contacts?.name ?? 'Unknown'}
              </p>
              <p className="text-xs text-gray-400 font-mono">{selectedConv.contacts?.phone}</p>
            </div>

            {/* Status badge */}
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0"
              style={{
                backgroundColor: STATUS[selectedConv.status]?.bg ?? '#f3f4f6',
                color: STATUS[selectedConv.status]?.text ?? '#374151',
              }}
            >
              {selectedConv.status}
            </span>

            {/* Action buttons */}
            {selectedConv.status === 'bot' && (
              <button
                onClick={() => updateStatus('handoff')}
                disabled={statusUpdating}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
              >
                Take Over
              </button>
            )}
            {selectedConv.status === 'handoff' && (
              <>
                <button
                  onClick={() => updateStatus('bot')}
                  disabled={statusUpdating}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
                >
                  Resume Bot
                </button>
                <button
                  onClick={() => updateStatus('closed')}
                  disabled={statusUpdating}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
                >
                  Close
                </button>
              </>
            )}
            {selectedConv.status === 'closed' && (
              <button
                onClick={() => updateStatus('bot')}
                disabled={statusUpdating}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
              >
                Reopen
              </button>
            )}
          </div>

          {/* Handoff summary bar */}
          {selectedConv.handoff_summary && (
            <div
              className="flex items-start gap-2 px-4 py-2.5 text-xs flex-shrink-0"
              style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#92400e' }}
            >
              <IconAlertCircle size={13} />
              <span><strong>Handoff:</strong> {selectedConv.handoff_summary}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4" style={{ backgroundColor: '#e5ddd5' }}>
            {msgLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-500">Loading…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-500">No messages yet</p>
              </div>
            ) : (
              grouped.map(({ date, msgs }) => (
                <div key={date}>
                  <div className="flex justify-center my-3">
                    <span
                      className="text-[11px] px-3 py-1 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: '#555' }}
                    >
                      {date}
                    </span>
                  </div>
                  {msgs.map((msg) => <Bubble key={msg.id} msg={msg} />)}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* 24-hour warning */}
          {outside24h && selectedConv.status !== 'closed' && (
            <div
              className="flex items-center gap-2 px-4 py-2 text-xs flex-shrink-0"
              style={{ backgroundColor: '#fffbeb', borderTop: '1px solid #fde68a', color: '#b45309' }}
            >
              <span>⏱</span>
              <span>Outside the 24-hour window. Message charges may apply.</span>
            </div>
          )}

          {/* Reply box */}
          <div
            className="flex items-end gap-3 px-4 py-3 flex-shrink-0 bg-white"
            style={{ borderTop: '1px solid #e5e7eb' }}
          >
            {!canReply ? (
              <p className="text-xs text-gray-400 py-2 flex-1">
                {selectedConv.status === 'closed'
                  ? 'Conversation closed.'
                  : 'Bot is handling this conversation. Click "Take Over" to reply.'}
              </p>
            ) : (
              <>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-gray-50 outline-none"
                  style={{ border: '1px solid #e5e7eb', maxHeight: 120 }}
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim() || sending}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40 text-white"
                  style={{ backgroundColor: '#0d3b33' }}
                >
                  <IconSend size={16} />
                </button>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return <Suspense><InboxContent /></Suspense>;
}
