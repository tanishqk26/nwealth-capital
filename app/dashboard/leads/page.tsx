'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { IconSearch } from '@/app/dashboard/components/Icons';
import { NewClientModal, type NewContact } from '@/app/dashboard/components/NewClientModal';
import { apiFetch } from '@/lib/fetch';

type Contact = { id: string; name: string; phone: string; type: string };
type Assignee = { id: string; name: string } | null;
type Lead = {
  id: string;
  intent: string;
  amount_range: string | null;
  callback_time: string | null;
  status: 'new' | 'assigned' | 'closed';
  created_at: string;
  conversation_id: string | null;
  contacts: Contact;
  assignee?: Assignee;
  assigned_to?: string | null;
};
type TeamMember = { id: string; name: string; status: string };

const FILTERS = ['all', 'new', 'callbacks', 'events', 'closed'] as const;
type Filter = typeof FILTERS[number];

const STATUS_OPTIONS = [
  { value: 'new',      label: 'New',      bg: '#fff3cd', color: '#7c4a03' },
  { value: 'assigned', label: 'Assigned', bg: '#d6eee9', color: '#0d3b33' },
  { value: 'closed',   label: 'Closed',   bg: '#f0f4f3', color: '#3d6b62' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── New Lead Modal ──────────────────────────────────────────
type NewLeadForm = {
  contact_id: string;
  intent: string;
  amount_range: string;
  callback_time: string;
  status: string;
};

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (lead: Lead) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<NewLeadForm>({
    contact_id: '', intent: '', amount_range: '', callback_time: '', status: 'new',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/dashboard/clients')
      .then((r) => r.json())
      .then((data) => setContacts(data ?? []));
    setTimeout(() => searchRef.current?.focus(), 80);
  }, []);

  const handleClientCreated = (contact: NewContact) => {
    setContacts((prev) => [contact as Contact, ...prev]);
    setForm((f) => ({ ...f, contact_id: contact.id }));
    setShowCreateClient(false);
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const selected = contacts.find((c) => c.id === form.contact_id);

  const submit = async () => {
    if (!form.contact_id || !form.intent.trim()) return;
    setSaving(true);
    setError('');
    const res = await apiFetch('/api/dashboard/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to create lead'); setSaving(false); return; }
    onCreated(data);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Lead</h2>
            <p className="text-xs text-gray-400 mt-0.5">Create a lead manually for an existing client</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          {/* Contact picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client *</label>
            {selected ? (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer"
                style={{ borderColor: '#0d3b33', backgroundColor: '#f0f9f7' }}
                onClick={() => { setForm((f) => ({ ...f, contact_id: '' })); setSearch(''); }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#1a7a6e' }}>
                  {selected.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{selected.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{selected.phone}</p>
                </div>
                <span className="text-xs text-gray-400">Change</span>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IconSearch size={14} /></span>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search client by name or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ borderColor: '#e5e7eb' }}
                    onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {filtered.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setForm((f) => ({ ...f, contact_id: c.id }))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: '#1a7a6e' }}>
                        {(c.name ?? '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.phone}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCreateClient(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{ backgroundColor: filtered.length === 0 ? '#f0f9f7' : 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9f7')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = filtered.length === 0 ? '#f0f9f7' : 'transparent')}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#e0f2f1', color: '#0d3b33' }}>
                      +
                    </div>
                    <p className="text-sm font-medium" style={{ color: '#0d3b33' }}>
                      {filtered.length === 0 && search ? `Create "${search}"` : 'Create new client'}
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Intent */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Intent / Topic *</label>
            <input
              type="text"
              value={form.intent}
              onChange={(e) => setForm((f) => ({ ...f, intent: e.target.value }))}
              placeholder="e.g. mutual_fund_inquiry, sip_setup, portfolio_review"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e5e7eb' }}
              onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Amount + Callback in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount Range</label>
              <input
                type="text"
                value={form.amount_range}
                onChange={(e) => setForm((f) => ({ ...f, amount_range: e.target.value }))}
                placeholder="e.g. 5L–10L"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Callback Time</label>
              <input
                type="text"
                value={form.callback_time}
                onChange={(e) => setForm((f) => ({ ...f, callback_time: e.target.value }))}
                placeholder="e.g. morning, 3pm"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                style={{ borderColor: '#e5e7eb' }}
                onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <CustomSelect
              value={form.status}
              options={STATUS_OPTIONS}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              pill
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!form.contact_id || !form.intent.trim() || saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#0d3b33' }}
          >
            {saving ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </div>

      {showCreateClient && (
        <NewClientModal
          prefillName={search}
          onClose={() => setShowCreateClient(false)}
          onCreated={handleClientCreated}
        />
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [role, setRole] = useState<string>('admin');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setRole(data.role);
        if (data.role === 'admin') {
          apiFetch('/api/dashboard/team')
            .then((r) => r.ok ? r.json() : [])
            .then((members) => setTeamMembers((members ?? []).filter((m: TeamMember) => m.status === 'active')))
            .catch(() => {});
        }
      })
      .catch(() => {});

    apiFetch('/api/dashboard/leads')
      .then((r) => r.json())
      .then((data) => { setLeads(data ?? []); setLoading(false); });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await apiFetch(`/api/dashboard/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: status as Lead['status'] } : l));
    setUpdating(null);
  };

  const updateAssignee = async (leadId: string, memberId: string) => {
    setUpdating(leadId + '_assign');
    await apiFetch(`/api/dashboard/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: memberId || null }),
    });
    const member = teamMembers.find((m) => m.id === memberId);
    setLeads((prev) => prev.map((l) =>
      l.id === leadId
        ? { ...l, assigned_to: memberId || null, assignee: memberId && member ? { id: member.id, name: member.name } : null }
        : l
    ));
    setUpdating(null);
  };

  const filtered = leads.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'new') return l.status === 'new';
    if (filter === 'callbacks') return l.intent === 'callback';
    if (filter === 'events') return l.intent?.startsWith('event_registration');
    if (filter === 'closed') return l.status === 'closed';
    return true;
  });

  const isAdmin = role === 'admin';

  const tableHeaders = [
    'Contact', 'Phone', 'Intent', 'Amount', 'Callback', 'Status',
    ...(isAdmin ? ['Assigned'] : []),
    'Chat', 'Date',
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight font-display">Leads & CRM</h1>
          <p className="text-sm text-gray-400 mt-1">Captured from the WhatsApp AI chatbot</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0d3b33' }}
          >
            <span className="text-base leading-none">+</span>
            New Lead
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors"
            style={{
              backgroundColor: filter === f ? '#0d3b33' : 'transparent',
              color: filter === f ? '#fff' : '#6b7280',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-400">No leads found</p>
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 text-sm font-medium"
                style={{ color: '#0d3b33' }}
              >
                + Create the first lead
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
                {tableHeaders.map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #f9fafb' }} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: '#1a7a6e' }}
                      >
                        {(lead.contacts?.name ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{lead.contacts?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{lead.contacts?.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[180px]">
                    <span className="truncate block" title={lead.intent}>{lead.intent ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.amount_range ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{lead.callback_time ?? '—'}</td>
                  <td className="px-4 py-3">
                    <CustomSelect
                      value={lead.status}
                      options={STATUS_OPTIONS}
                      onChange={(v) => updateStatus(lead.id, v)}
                      disabled={updating === lead.id}
                      pill
                    />
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <CustomSelect
                        value={lead.assigned_to ?? lead.assignee?.id ?? ''}
                        options={[
                          { value: '', label: 'Unassigned', bg: '#f3f4f6', color: '#9ca3af' },
                          ...teamMembers.map((m) => ({ value: m.id, label: m.name, bg: '#d6eee9', color: '#0d3b33' })),
                        ]}
                        onChange={(v) => updateAssignee(lead.id, v)}
                        disabled={updating === lead.id + '_assign'}
                        pill
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {lead.conversation_id ? (
                      <Link
                        href={`/dashboard/conversations/${lead.conversation_id}`}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: '#f0f9f7', color: '#0d3b33' }}
                      >
                        View →
                      </Link>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!loading && (
        <p className="text-xs text-gray-400 mt-3">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {showModal && (
        <NewLeadModal
          onClose={() => setShowModal(false)}
          onCreated={(lead) => setLeads((prev) => [lead, ...prev])}
        />
      )}
    </div>
  );
}
