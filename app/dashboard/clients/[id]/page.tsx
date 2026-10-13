'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { IconChevronLeft, IconMessage, IconTrendingUp, IconAlertCircle, IconArrowRight, IconCheck } from '@/app/dashboard/components/Icons';
import { apiFetch } from '@/lib/fetch';

type Contact = {
  id: string;
  name: string;
  phone: string;
  type: 'prospect' | 'client';
  language: string;
  source: string;
  created_at: string;
};
type Conversation = {
  id: string;
  status: string;
  handoff_reason: string | null;
  handoff_summary: string | null;
  created_at: string;
  last_message_at: string;
};
type Lead = {
  id: string;
  intent: string;
  amount_range: string | null;
  callback_time: string | null;
  status: string;
  created_at: string;
  conversation_id: string | null;
};
type Profile = { contact: Contact; conversations: Conversation[]; leads: Lead[] };

const TYPE_THEME = {
  prospect: { bg: '#fff7ed', text: '#c2410c' },
  client:   { bg: '#d6eee9', text: '#0d3b33' },
};
const CONV_STATUS: Record<string, { bg: string; text: string }> = {
  bot:     { bg: '#f3f4f6', text: '#374151' },
  handoff: { bg: '#fef3c7', text: '#92400e' },
  closed:  { bg: '#d1fae5', text: '#065f46' },
};
const LEAD_STATUS: Record<string, { bg: string; text: string }> = {
  new:      { bg: '#fff3cd', text: '#7c4a03' },
  assigned: { bg: '#d6eee9', text: '#0d3b33' },
  closed:   { bg: '#f0f4f3', text: '#3d6b62' },
};
const LANGUAGES = ['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'bn', 'pa'];

const TYPE_OPTIONS = [
  { value: 'prospect', label: 'Prospect', bg: '#fff7ed', color: '#c2410c' },
  { value: 'client',   label: 'Client',   bg: '#d6eee9', color: '#0d3b33' },
];
const LANG_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l.toUpperCase() }));

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Partial<Contact>>({});

  useEffect(() => {
    apiFetch(`/api/dashboard/clients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setDraft({ name: data.contact?.name, phone: data.contact?.phone, type: data.contact?.type, language: data.contact?.language });
        setLoading(false);
      });
  }, [id]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    await apiFetch(`/api/dashboard/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    setProfile((p) => p ? { ...p, contact: { ...p.contact, ...draft } as Contact } : p);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty = profile && (
    draft.name !== profile.contact.name ||
    draft.phone !== profile.contact.phone ||
    draft.type !== profile.contact.type ||
    draft.language !== profile.contact.language
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-gray-400">Loading profile…</p>
      </div>
    );
  }

  if (!profile?.contact) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Client not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-sm" style={{ color: '#0d3b33' }}>← Back</button>
      </div>
    );
  }

  const { contact, conversations, leads } = profile;
  const typeMeta = TYPE_THEME[contact.type] ?? TYPE_THEME.prospect;
  const initial = (contact.name ?? '?')[0].toUpperCase();

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: '#9ca3af' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0d3b33')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
      >
        <IconChevronLeft size={16} /> All Clients
      </button>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        {/* Header band */}
        <div className="h-20" style={{ background: 'linear-gradient(135deg, #0d3b33 0%, #1a7a6e 100%)' }} />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-10 mb-5">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white border-4 border-white shadow-md"
              style={{ backgroundColor: '#1a7a6e' }}
            >
              {initial}
            </div>
            <div className="flex items-center gap-2 mt-12">
              {saved && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium" style={{ backgroundColor: '#d6eee9', color: '#0d3b33' }}>
                  <IconCheck size={13} /> Saved
                </span>
              )}
              {isDirty && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-sm px-4 py-1.5 rounded-xl font-semibold text-white transition-opacity"
                  style={{ backgroundColor: '#0d3b33', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </div>
          </div>

          {/* Editable fields grid */}
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Name</label>
              <input
                value={draft.name ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm text-gray-800 outline-none transition-colors"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                placeholder="Client name"
              />
            </div>

            {/* Phone — editable (auto-filled from WhatsApp when using real SDK) */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Phone
                <span className="ml-1.5 normal-case font-normal text-gray-300">· auto from WhatsApp in prod</span>
              </label>
              <input
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm font-mono text-gray-700 outline-none transition-colors"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Type</label>
              <CustomSelect
                value={draft.type ?? 'prospect'}
                options={TYPE_OPTIONS}
                onChange={(v) => setDraft((d) => ({ ...d, type: v as Contact['type'] }))}
                pill
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Language</label>
              <CustomSelect
                value={draft.language ?? 'en'}
                options={LANG_OPTIONS}
                onChange={(v) => setDraft((d) => ({ ...d, language: v }))}
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Source</label>
              <div className="px-3 py-2 rounded-xl border text-sm text-gray-500" style={{ borderColor: '#f3f4f6', backgroundColor: '#fafafa' }}>
                {contact.source ?? 'whatsapp'}
              </div>
            </div>

            {/* Since */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Client since</label>
              <div className="px-3 py-2 rounded-xl border text-sm text-gray-500" style={{ borderColor: '#f3f4f6', backgroundColor: '#fafafa' }}>
                {formatDate(contact.created_at)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Conversations', value: conversations.length, color: '#0d3b33', lightBg: '#f0f9f7', icon: <IconMessage size={16} /> },
          { label: 'Leads Generated', value: leads.length, color: '#7c4a03', lightBg: '#fff3cd', icon: <IconTrendingUp size={16} /> },
          { label: 'Handoffs', value: conversations.filter((c) => c.status === 'handoff').length, color: '#92400e', lightBg: '#fef3c7', icon: <IconAlertCircle size={16} /> },
        ].map(({ label, value, color, lightBg, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: lightBg, color }}>{icon}</div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Conversations + Leads side by side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Conversations */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Conversations</p>
            <span className="text-xs text-gray-400">{conversations.length}</span>
          </div>
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No conversations yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {conversations.map((conv) => {
                const badge = CONV_STATUS[conv.status] ?? CONV_STATUS.bot;
                return (
                  <Link
                    key={conv.id}
                    href={`/dashboard/conversations/${conv.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
                    style={conv.status === 'handoff' ? { borderLeft: '3px solid #f59e0b' } : {}}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {conv.status}
                        </span>
                        {conv.handoff_summary && (
                          <span className="text-xs text-gray-400 truncate max-w-[160px]">{conv.handoff_summary}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(conv.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{relativeTime(conv.last_message_at)}</span>
                      <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#0d3b33' }}>→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Leads */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Leads</p>
            <span className="text-xs text-gray-400">{leads.length}</span>
          </div>
          {leads.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No leads yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {leads.map((lead) => {
                const badge = LEAD_STATUS[lead.status] ?? LEAD_STATUS.new;
                return (
                  <div key={lead.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{lead.intent ?? '—'}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {lead.amount_range && (
                            <span className="text-xs text-gray-500">{lead.amount_range}</span>
                          )}
                          {lead.callback_time && (
                            <span className="text-xs text-gray-500">cb: {lead.callback_time}</span>
                          )}
                          <span className="text-xs text-gray-400">{formatDate(lead.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                          style={{ backgroundColor: badge.bg, color: badge.text }}
                        >
                          {lead.status}
                        </span>
                        {lead.conversation_id && (
                          <Link
                            href={`/dashboard/conversations/${lead.conversation_id}`}
                            className="text-xs px-2 py-0.5 rounded-lg"
                            style={{ backgroundColor: '#f0f9f7', color: '#0d3b33' }}
                          >
                            Chat →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
