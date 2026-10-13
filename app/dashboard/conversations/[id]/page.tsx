'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconChevronLeft } from '@/app/dashboard/components/Icons';

type Contact = { id: string; name: string; phone: string; type: string; language: string; source: string };
type Message = { id: string; direction: 'inbound' | 'outbound'; body: string; created_at: string };
type Lead = { id: string; intent: string; amount_range: string | null; callback_time: string | null; status: string; created_at: string };
type Conversation = {
  id: string;
  status: string;
  handoff_reason: string | null;
  handoff_summary: string | null;
  created_at: string;
  last_message_at: string;
  contacts: Contact;
};

type Detail = { conversation: Conversation; messages: Message[]; leads: Lead[] };

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  bot:     { bg: '#f3f4f6', text: '#374151' },
  handoff: { bg: '#fef3c7', text: '#92400e' },
  closed:  { bg: '#d1fae5', text: '#065f46' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.direction === 'inbound';
  return (
    <div className={`flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mr-2 mt-1"
          style={{ backgroundColor: '#1a7a6e' }}
        >N</div>
      )}
      <div
        className="max-w-[70%] rounded-xl px-3 py-2 text-sm shadow-sm"
        style={{
          backgroundColor: isUser ? '#d9fdd3' : '#ffffff',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        }}
      >
        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        <p className="text-right text-[10px] text-gray-400 mt-0.5">{formatTime(msg.created_at)}</p>
      </div>
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/conversations/${id}`)
      .then((r) => r.json())
      .then((data) => { setDetail(data); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading conversation…</p>
      </div>
    );
  }

  if (!detail?.conversation) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Conversation not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-sm" style={{ color: '#0d3b33' }}>← Back</button>
      </div>
    );
  }

  const { conversation, messages, leads } = detail;
  const contact = conversation.contacts;
  const badge = STATUS_BADGE[conversation.status] ?? STATUS_BADGE.bot;

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last?.date === date) last.msgs.push(msg);
    else grouped.push({ date, msgs: [msg] });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left: message thread ──────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <IconChevronLeft size={18} />
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: '#1a7a6e' }}
          >
            {(contact?.name ?? '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm">{contact?.name ?? 'Unknown'}</p>
            <p className="text-xs text-gray-400 font-mono">{contact?.phone}</p>
          </div>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {conversation.status}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ backgroundColor: '#e5ddd5' }}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-500">No messages in this conversation</p>
            </div>
          ) : (
            grouped.map(({ date, msgs }) => (
              <div key={date}>
                <div className="flex justify-center my-3">
                  <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.07)', color: '#555' }}>
                    {date}
                  </span>
                </div>
                {msgs.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: summary panel ──────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</p>
        </div>

        {/* Contact info */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-800">{contact?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-mono text-xs text-gray-700">{contact?.phone ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="capitalize text-gray-700">{contact?.type ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Language</span>
              <span className="uppercase text-xs text-gray-700">{contact?.language ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Conversation stats */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Conversation</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Messages</span>
              <span className="font-medium text-gray-800">{messages.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Started</span>
              <span className="text-xs text-gray-700">{formatDate(conversation.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {conversation.status}
              </span>
            </div>
          </div>
        </div>

        {/* Handoff info */}
        {(conversation.handoff_reason || conversation.handoff_summary) && (
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Handoff Info</p>
            {conversation.handoff_reason && (
              <div className="mb-2">
                <p className="text-xs text-gray-400">Reason</p>
                <p className="text-sm text-gray-700 mt-0.5">{conversation.handoff_reason}</p>
              </div>
            )}
            {conversation.handoff_summary && (
              <div>
                <p className="text-xs text-gray-400">Summary</p>
                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{conversation.handoff_summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Leads generated */}
        {leads.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Leads Generated ({leads.length})
            </p>
            <div className="space-y-3">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-xl p-3" style={{ backgroundColor: '#f8fffe', border: '1px solid #e0f2f1' }}>
                  <p className="text-xs font-medium" style={{ color: '#0d3b33' }}>{lead.intent}</p>
                  {lead.amount_range && (
                    <p className="text-xs text-gray-500 mt-1">Amount: {lead.amount_range}</p>
                  )}
                  {lead.callback_time && (
                    <p className="text-xs text-gray-500 mt-0.5">Callback: {lead.callback_time}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{
                        backgroundColor: lead.status === 'new' ? '#fff7ed' : lead.status === 'assigned' ? '#d1fae5' : '#f3f4f6',
                        color: lead.status === 'new' ? '#c2410c' : lead.status === 'assigned' ? '#065f46' : '#6b7280',
                      }}
                    >
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(lead.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
