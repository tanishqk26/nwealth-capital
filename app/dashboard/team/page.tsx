'use client';

import { useEffect, useState } from 'react';
import { IconUsers, IconUser } from '@/app/dashboard/components/Icons';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { apiFetch } from '@/lib/fetch';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: 'active' | 'inactive';
  last_assigned_at: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Active',   bg: '#d6eee9', color: '#0d3b33' },
  { value: 'inactive', label: 'Inactive', bg: '#f3f4f6', color: '#6b7280' },
];

const ROLE_OPTIONS = [
  { value: 'salesperson', label: 'Salesperson', bg: '#eff6ff', color: '#1d4ed8' },
];

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return <span className="text-gray-400 text-xs">{status}</span>;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: opt.bg, color: opt.color }}
    >
      {opt.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Add Member Modal ────────────────────────────────────────
function AddMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: TeamMember) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'salesperson' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
    setSaving(true);
    setError('');
    const res = await apiFetch('/api/dashboard/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to create member'); setSaving(false); return; }
    onCreated(data);
    onClose();
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border text-sm outline-none';
  const inputStyle = { borderColor: '#e5e7eb' };
  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#0d3b33');
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#e5e7eb');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add Team Member</h2>
            <p className="text-xs text-gray-400 mt-0.5">Create a new salesperson account</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name" className={inputCls} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com" className={inputCls} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210" className={inputCls} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password *</label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Minimum 8 characters" className={inputCls} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
            <CustomSelect value={form.role} options={ROLE_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, role: v }))} pill />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!form.name.trim() || !form.email.trim() || !form.password.trim() || saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#0d3b33' }}
          >
            {saving ? 'Creating…' : 'Add member'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Member Modal ───────────────────────────────────────
function EditMemberModal({ member, onClose, onUpdated }: { member: TeamMember; onClose: () => void; onUpdated: (m: TeamMember) => void }) {
  const [form, setForm] = useState({ name: member.name, phone: member.phone ?? '', status: member.status });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    const res = await apiFetch(`/api/dashboard/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to update'); setSaving(false); return; }
    onUpdated(data);
    onClose();
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border text-sm outline-none';
  const inputStyle = { borderColor: '#e5e7eb' };
  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#0d3b33');
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = '#e5e7eb');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit Member</h2>
            <p className="text-xs text-gray-400 mt-0.5">{member.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210" className={inputCls} style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <CustomSelect value={form.status} options={STATUS_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, status: v as 'active' | 'inactive' }))} pill />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#0d3b33' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reset Password Modal ────────────────────────────────────
function ResetPasswordModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!password.trim()) return;
    setSaving(true);
    setError('');
    const res = await apiFetch(`/api/dashboard/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to reset password'); setSaving(false); return; }
    setSuccess(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Reset Password</h2>
            <p className="text-xs text-gray-400 mt-0.5">{member.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#fff1f0', color: '#c0392b', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#d6eee9', color: '#0d3b33', border: '1px solid #a7d7cc' }}>
              Password updated successfully
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: '#e5e7eb' }}
              onFocus={(e) => (e.target.style.borderColor = '#0d3b33')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!password.trim() || saving || success}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#0d3b33' }}
          >
            {saving ? 'Saving…' : 'Reset password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ────────────────────────────────────
function DeleteConfirmModal({ member, onClose, onDeleted }: { member: TeamMember; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    await apiFetch(`/api/dashboard/team/${member.id}`, { method: 'DELETE' });
    onDeleted(member.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-base font-semibold text-gray-900">Delete Member</h2>
          <p className="text-sm text-gray-500 mt-2">
            Are you sure you want to delete <strong>{member.name}</strong>? This action cannot be undone.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#dc2626' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
type ModalState =
  | { type: 'add' }
  | { type: 'edit'; member: TeamMember }
  | { type: 'reset'; member: TeamMember }
  | { type: 'delete'; member: TeamMember }
  | null;

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    apiFetch('/api/dashboard/team')
      .then((r) => r.json())
      .then((data) => { setMembers(data ?? []); setLoading(false); });
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#d6eee9', color: '#0d3b33' }}
          >
            <IconUsers size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight font-display">Team</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage salesperson accounts and access</p>
          </div>
        </div>
        <button
          onClick={() => setModal({ type: 'add' })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0d3b33' }}
        >
          <span className="text-base leading-none">+</span>
          Add Team Member
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading team…</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#f0f9f7', color: '#0d3b33' }}>
              <IconUser size={22} />
            </div>
            <p className="text-sm text-gray-500 font-medium">No team members yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first salesperson to get started</p>
            <button
              onClick={() => setModal({ type: 'add' })}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: '#0d3b33' }}
            >
              + Add member
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f9fafb' }} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: '#1a7a6e' }}
                      >
                        {m.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{m.email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModal({ type: 'edit', member: m })}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setModal({ type: 'reset', member: m })}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => setModal({ type: 'delete', member: m })}
                        className="px-3 py-1 rounded-lg text-xs font-medium border text-red-500 hover:bg-red-50 transition-colors"
                        style={{ borderColor: '#fca5a5' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && members.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {members.length} member{members.length !== 1 ? 's' : ''} · {members.filter((m) => m.status === 'active').length} active
        </p>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <AddMemberModal
          onClose={() => setModal(null)}
          onCreated={(m) => setMembers((prev) => [m, ...prev])}
        />
      )}

      {modal?.type === 'edit' && (
        <EditMemberModal
          member={modal.member}
          onClose={() => setModal(null)}
          onUpdated={(updated) => setMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m))}
        />
      )}

      {modal?.type === 'reset' && (
        <ResetPasswordModal
          member={modal.member}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteConfirmModal
          member={modal.member}
          onClose={() => setModal(null)}
          onDeleted={(id) => setMembers((prev) => prev.filter((m) => m.id !== id))}
        />
      )}
    </div>
  );
}
