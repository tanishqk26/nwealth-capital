'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { IconAlertCircle, IconArrowRight } from '@/app/dashboard/components/Icons';
import { apiFetch } from '@/lib/fetch';

type Contact = { id: string; name: string; phone: string };
type LastMessage = { body: string; direction: string; created_at: string };
type Conversation = {
  id: string;
  status: 'bot' | 'handoff' | 'closed';
  handoff_reason: string | null;
  handoff_summary: string | null;
  last_message_at: string;
  created_at: string;
  contacts: Contact;
  last_message: LastMessage | null;
};

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  bot:     { label: 'Bot',     bg: '#f3f4f6', text: '#374151' },
  handoff: { label: 'Handoff', bg: '#fef3c7', text: '#92400e' },
  closed:  { label: 'Closed',  bg: '#d1fae5', text: '#065f46' },
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ConversationsList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<'all' | 'handoff' | 'bot' | 'closed'>('all');
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const contactFilter = searchParams.get('contact');

  useEffect(() => {
    apiFetch('/api/dashboard/conversations')
      .then((r) => r.json())
      .then((data) => { setConversations(data ?? []); setLoading(false); });
  }, []);

  const filtered = conversations.filter((c) => {
    if (contactFilter && c.contacts?.id !== contactFilter) return false;
    return filter === 'all' ? true : c.status === filter;
  });

  const handoffCount = conversations.filter((c) => c.status === 'handoff').length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Conversations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {contactFilter ? 'Filtered by contact' : 'All WhatsApp sessions'} · click to view full chat
          </p>
        </div>
        {handoffCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            <IconAlertCircle size={14} />
            {handoffCount} handoff{handoffCount > 1 ? 's' : ''} need attention
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
        {(['all', 'handoff', 'bot', 'closed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors"
            style={{ backgroundColor: filter === f ? '#0d3b33' : 'transparent', color: filter === f ? '#fff' : '#6b7280' }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-sm text-gray-400 border border-gray-100">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-sm text-gray-400 border border-gray-100">No conversations found</div>
        ) : (
          filtered.map((conv) => {
            const badge = STATUS_BADGE[conv.status] ?? STATUS_BADGE.bot;
            return (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 px-5 py-4 hover:shadow-md transition-shadow block"
                style={conv.status === 'handoff' ? { borderLeft: '3px solid #f59e0b' } : {}}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: '#1a7a6e' }}
                >
                  {(conv.contacts?.name ?? '?')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 text-sm">{conv.contacts?.name ?? 'Unknown'}</p>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{conv.contacts?.phone}</p>
                  {conv.last_message && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {conv.last_message.direction === 'inbound' ? '← ' : '→ '}{conv.last_message.body}
                    </p>
                  )}
                  {conv.handoff_summary && (
                    <p className="text-xs mt-1 truncate flex items-center gap-1" style={{ color: '#b45309' }}>
                      <IconAlertCircle size={11} />
                      {conv.handoff_summary}
                    </p>
                  )}
                </div>

                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <p className="text-xs text-gray-400">{relativeTime(conv.last_message_at)}</p>
                  <span style={{ color: '#0d3b33' }}><IconArrowRight size={14} /></span>
                </div>
              </Link>
            );
          })
        )}
      </div>
      {!loading && (
        <p className="text-xs text-gray-400 mt-3">{filtered.length} conversation{filtered.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  return <Suspense><ConversationsList /></Suspense>;
}
