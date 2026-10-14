'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/fetch';
import { IconCheck } from '@/app/dashboard/components/Icons';

type Task = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'done' | 'cancelled';
  due_at: string | null;
  source: string;
  created_at: string;
  contact: { id: string; name: string; phone: string } | null;
  assignee: { id: string; name: string } | null;
  assignee_id: string | null;
};
type Member = { id: string; name: string; status: string };

const TABS = ['overdue', 'today', 'upcoming', 'nodate', 'done'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', nodate: 'No date', done: 'Done',
};

const TYPE_LABEL: Record<string, string> = {
  callback: 'Callback', meeting: 'Meeting', portfolio_review: 'Portfolio review', sip_issue: 'SIP issue',
  kyc_help: 'KYC help', document_request: 'Documents', cas_review: 'CAS review', event_followup: 'Event follow-up',
  complaint: 'Complaint', follow_up: 'Follow-up', reminder: 'Reminder', other: 'Other',
};
const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#fde2e0', color: '#9b1c12' },
  normal: { bg: '#eef2f1', color: '#3d6b62' },
  low:    { bg: '#f4f4f2', color: '#8a8a84' },
};

const EXAMPLES = [
  'Tomorrow 5pm meeting with Rahul Sharma to review his portfolio, remind me',
  'Friday call Mrs. Joshi about her failed SIP debit',
  'kal subah KYC documents Amit se collect karne hain',
];

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function bucket(t: Task): Tab {
  if (t.status !== 'open') return 'done';
  if (!t.due_at) return 'nodate';
  const due = new Date(t.due_at).getTime();
  const today = startOfToday().getTime();
  if (due < Date.now()) return 'overdue';
  if (due < today + 86400000) return 'today';
  return 'upcoming';
}

function fmtDue(iso: string | null) {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pickedTab, setTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(() => {
    return apiFetch('/api/dashboard/tasks')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Task[]) => { setTasks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
    apiFetch('/api/auth/me').then((r) => r.json()).then((a) => {
      if (a.role === 'admin') {
        setIsAdmin(true);
        apiFetch('/api/dashboard/team').then((r) => r.json()).then((m) => setTeam(Array.isArray(m) ? m : []));
      }
    }).catch(() => {});
  }, [load]);

  const grouped = useMemo(() => {
    const g: Record<Tab, Task[]> = { overdue: [], today: [], upcoming: [], nodate: [], done: [] };
    tasks.filter((t) => t.status !== 'cancelled').forEach((t) => g[bucket(t)].push(t));
    g.done.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    return g;
  }, [tasks]);

  const quickAdd = async () => {
    if (!text.trim() || adding) return;
    setAdding(true);
    setNotice(null);
    try {
      const res = await apiFetch('/api/dashboard/tasks/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice({ kind: 'err', msg: data.error ?? 'Failed to create task' }); return; }
      const t = data.task;
      setNotice({
        kind: 'ok',
        msg: `Added: “${t.title}” — ${fmtDue(t.due_at)}${data.linkedClient ? ` · linked to ${data.linkedClient}` : ''}${data.unmatchedClient ? ` · client “${data.unmatchedClient}” not found in contacts` : ''}`,
      });
      setText('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...(body as Partial<Task>) } : t)));
    await apiFetch(`/api/dashboard/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    load();
  };

  const remove = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await apiFetch(`/api/dashboard/tasks/${id}`, { method: 'DELETE' });
  };

  // Until the user picks a tab, land on the most urgent non-empty one
  const tab: Tab = pickedTab ?? (grouped.overdue.length ? 'overdue' : grouped.today.length ? 'today' : grouped.upcoming.length ? 'upcoming' : 'today');
  const list = grouped[tab];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: '#0d3b33' }}>Tasks & Reminders</h1>
      <p className="text-sm mb-6" style={{ color: '#6b7a76' }}>
        Follow-ups created by the WhatsApp bot, plus anything you add yourself.
      </p>

      {/* Quick add */}
      <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
            placeholder="Tell me what to remember… e.g. “Tomorrow 5pm meeting with Rahul Sharma to review portfolio”"
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 placeholder-gray-400 bg-white"
            style={{ borderColor: '#e5e7eb' }}
          />
          <button
            onClick={quickAdd}
            disabled={adding || !text.trim()}
            className="px-5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#0d3b33' }}
          >
            {adding ? 'Adding…' : 'Add task'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setText(ex)} className="text-xs px-3 py-1 rounded-full"
              style={{ backgroundColor: '#f0f4f3', color: '#3d6b62' }}>
              {ex}
            </button>
          ))}
        </div>
        {notice && (
          <p className="text-sm mt-3" style={{ color: notice.kind === 'ok' ? '#0d6b4f' : '#b42318' }}>{notice.msg}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-full text-sm"
            style={{
              backgroundColor: tab === t ? '#0d3b33' : '#fff',
              color: tab === t ? '#fff' : '#3d6b62',
              border: '1px solid ' + (tab === t ? '#0d3b33' : '#e5e7eb'),
            }}
          >
            {TAB_LABEL[t]}
            <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{grouped[t].length}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && <p className="text-sm" style={{ color: '#6b7a76' }}>Loading…</p>}
        {!loading && list.length === 0 && (
          <p className="text-sm py-10 text-center" style={{ color: '#9aa5a1' }}>Nothing here.</p>
        )}
        {list.map((t) => {
          const overdue = bucket(t) === 'overdue';
          const done = t.status === 'done';
          const pr = PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.normal;
          return (
            <div key={t.id} className="flex items-start gap-3 rounded-xl p-4"
              style={{ backgroundColor: '#fff', border: '1px solid ' + (overdue ? '#f5b5af' : '#e5e7eb') }}>
              <button
                onClick={() => patch(t.id, { status: done ? 'open' : 'done' })}
                title={done ? 'Reopen' : 'Mark done'}
                className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ border: '1.5px solid #0d3b33', backgroundColor: done ? '#0d3b33' : 'transparent', color: '#fff' }}
              >
                {done && <IconCheck size={12} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#1a1a18', textDecoration: done ? 'line-through' : 'none' }}>
                  {t.title}
                </p>
                {t.description && <p className="text-xs mt-0.5" style={{ color: '#6b7a76' }}>{t.description}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d6eee9', color: '#0d3b33' }}>
                    {TYPE_LABEL[t.type] ?? t.type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: pr.bg, color: pr.color }}>{t.priority}</span>
                  <span style={{ color: overdue ? '#b42318' : '#6b7a76' }}>{fmtDue(t.due_at)}</span>
                  {t.contact && (
                    <Link href={`/dashboard/clients/${t.contact.id}`} className="underline" style={{ color: '#0d3b33' }}>
                      {t.contact.name}
                    </Link>
                  )}
                  {t.source === 'bot' && <span style={{ color: '#9aa5a1' }}>· created by bot</span>}
                </div>
              </div>
              {isAdmin && (
                <select
                  value={t.assignee_id ?? ''}
                  onChange={(e) => patch(t.id, { assignee_id: e.target.value || null })}
                  className="text-xs border rounded-lg px-2 py-1 text-gray-700 bg-white"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <option value="">Admin</option>
                  {team.filter((m) => m.status === 'active').map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
              <button onClick={() => remove(t.id)} className="text-xs" style={{ color: '#9aa5a1' }} title="Delete">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
