'use client';

import { useState } from 'react';
import { CustomSelect } from './CustomSelect';
import { apiFetch } from '@/lib/fetch';

export type NewContact = {
  id: string;
  name: string;
  phone: string;
  type: 'prospect' | 'client';
  language: string;
  source: string;
  created_at: string;
};

const TYPE_OPTIONS = [
  { value: 'prospect', label: 'Prospect', bg: '#fff7ed', color: '#c2410c' },
  { value: 'client',   label: 'Client',   bg: '#d6eee9', color: '#0d3b33' },
];
const LANG_OPTIONS = ['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'bn', 'pa'].map((l) => ({
  value: l, label: l.toUpperCase(),
}));

type Props = {
  onClose: () => void;
  onCreated: (contact: NewContact) => void;
  /** Pre-fill name from a search the user already typed */
  prefillName?: string;
};

export function NewClientModal({ onClose, onCreated, prefillName = '' }: Props) {
  const [form, setForm] = useState({ name: prefillName, phone: '', type: 'prospect', language: 'en' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const phoneDigits = form.phone.replace(/\D/g, '');
  const canSubmit = form.name.trim() && phoneDigits.length >= 10 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    const res = await apiFetch('/api/dashboard/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to create client'); setSaving(false); return; }
    onCreated(data);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Client</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add a client manually to the CRM</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name *</label>
            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Rahul Sharma"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e5e7eb' }}
              onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone * <span className="normal-case font-normal text-gray-300">(min 10 digits)</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono outline-none"
              style={{ borderColor: '#e5e7eb' }}
              onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Type + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
              <CustomSelect
                value={form.type}
                options={TYPE_OPTIONS}
                onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                pill
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Language</label>
              <CustomSelect
                value={form.language}
                options={LANG_OPTIONS}
                onChange={(v) => setForm((f) => ({ ...f, language: v }))}
              />
            </div>
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
            disabled={!canSubmit}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#0d3b33' }}
          >
            {saving ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </div>
    </div>
  );
}
