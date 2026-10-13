'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NewClientModal, type NewContact } from '@/app/dashboard/components/NewClientModal';
import { apiFetch } from '@/lib/fetch';

type Contact = {
  id: string;
  name: string;
  phone: string;
  type: 'prospect' | 'client';
  language: string;
  source: string;
  created_at: string;
  conversation_count: number;
  lead_count: number;
};

const TYPE_THEME = {
  prospect: { bg: '#fff7ed', text: '#c2410c', label: 'Prospect' },
  client:   { bg: '#d6eee9', text: '#0d3b33', label: 'Client' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteContact = async (id: string) => {
    setDeleting(true);
    await apiFetch(`/api/dashboard/clients/${id}`, { method: 'DELETE' });
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
    setDeleting(false);
  };

  useEffect(() => {
    apiFetch('/api/dashboard/clients')
      .then((r) => r.json())
      .then((data) => { setContacts(data ?? []); setLoading(false); });
  }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight font-display">Clients</h1>
          <p className="text-sm text-gray-400 mt-1">Click any row to open the full client profile</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 outline-none"
            style={{ width: 220 }}
            onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: '#0d3b33' }}
          >
            <span className="text-base leading-none">+</span>
            New Client
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">{search ? 'No clients match your search' : 'No clients yet'}</p>
            {!search && (
              <button onClick={() => setShowModal(true)} className="mt-3 text-sm font-medium" style={{ color: '#0d3b33' }}>
                + Add the first client
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                {['Contact', 'Phone', 'Type', 'Language', 'Conversations', 'Leads', 'Since', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const typeMeta = TYPE_THEME[contact.type] ?? TYPE_THEME.prospect;
                return (
                  <tr
                    key={contact.id}
                    style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer' }}
                    className="group hover:bg-gray-50 transition-colors"
                    onClick={() => window.location.href = `/dashboard/clients/${contact.id}`}
                  >
                    {/* Name + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: '#1a7a6e' }}
                        >
                          {(contact.name ?? '?')[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800 group-hover:underline">
                          {contact.name ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{contact.phone ?? '—'}</td>

                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: typeMeta.bg, color: typeMeta.text }}
                      >
                        {typeMeta.label}
                      </span>
                    </td>

                    {/* Language */}
                    <td className="px-4 py-3 text-xs text-gray-500 uppercase">{contact.language ?? 'en'}</td>

                    {/* Conversation count */}
                    <td className="px-4 py-3 text-center">
                      {contact.conversation_count > 0 ? (
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                          style={{ backgroundColor: '#e0f2f1', color: '#0d3b33' }}
                        >
                          {contact.conversation_count}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Lead count */}
                    <td className="px-4 py-3 text-center">
                      {contact.lead_count > 0 ? (
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                          style={{ backgroundColor: '#fff3cd', color: '#7c4a03' }}
                        >
                          {contact.lead_count}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(contact.created_at)}</td>

                    {/* Delete */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {confirmDelete === contact.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button
                            onClick={() => deleteContact(contact.id)}
                            disabled={deleting}
                            className="text-xs px-2 py-1 rounded-lg font-medium text-white transition-opacity disabled:opacity-40"
                            style={{ backgroundColor: '#dc2626' }}
                          >
                            {deleting ? '…' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs px-2 py-1 rounded-lg text-gray-500 border border-gray-200 hover:bg-gray-50"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(contact.id)}
                          className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!loading && (
        <p className="text-xs text-gray-400 mt-3">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</p>
      )}

      {showModal && (
        <NewClientModal
          onClose={() => setShowModal(false)}
          onCreated={(contact) => {
            setContacts((prev) => [{ ...contact, conversation_count: 0, lead_count: 0 } as Contact, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
