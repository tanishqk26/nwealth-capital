'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconHome, IconUsers, IconUser, IconMessage,
  IconBook, IconLogOut, IconExternalLink, IconTrendingUp, IconInbox, IconCheck,
} from '@/app/dashboard/components/Icons';
import { apiFetch } from '@/lib/fetch';

type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean; adminOnly?: boolean; external?: boolean };

const NAV: NavItem[] = [
  { href: '/dashboard',               label: 'Overview',       icon: <IconHome />,         exact: true },
  { href: '/dashboard/leads',         label: 'Leads & CRM',    icon: <IconTrendingUp /> },
  { href: '/dashboard/tasks',         label: 'Tasks',          icon: <IconCheck /> },
  { href: '/dashboard/clients',       label: 'Clients',        icon: <IconUser /> },
  { href: '/dashboard/conversations', label: 'Conversations',  icon: <IconMessage /> },
  { href: '/assistant',              label: 'My Assistant',   icon: <IconMessage />,      external: true },
  { href: '/inbox',                   label: 'WA Inbox',       icon: <IconInbox />,        external: true },
  { href: '/dashboard/kb',            label: 'Knowledge Base', icon: <IconBook /> },
  { href: '/dashboard/team',          label: 'Team',           icon: <IconUsers />, adminOnly: true },
];

type AuthInfo = { role: string; name: string } | null;

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthInfo>(null);
  const [handoffCount, setHandoffCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setAuth({ role: data.role, name: data.name }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => {
      apiFetch('/api/dashboard/conversations')
        .then((r) => r.json())
        .then((data: Array<{ status: string }>) => {
          setHandoffCount((data ?? []).filter((c) => c.status === 'handoff').length);
        })
        .catch(() => {});
    };
    const loadTasks = () => {
      fetch('/api/dashboard/tasks?status=open')
        .then((r) => (r.ok ? r.json() : []))
        .then((data: Array<{ due_at: string | null }>) => {
          const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
          setTaskCount((data ?? []).filter((t) => t.due_at && new Date(t.due_at) <= endOfToday).length);
        })
        .catch(() => {});
    };
    load();
    loadTasks();
    const interval = setInterval(() => { load(); loadTasks(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const visibleNav = NAV.filter((item) => {
    if (item.adminOnly && auth?.role !== 'admin') return false;
    return true;
  });

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0 h-screen sticky top-0"
      style={{ backgroundColor: '#0d3b33', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-semibold text-sm tracking-tight leading-tight font-display">
          Nwealth Capital
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
          STAFF DASHBOARD
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ href, label, icon, exact, external }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const isInbox = href === '/inbox';
          const isTasks = href === '/dashboard/tasks';
          return (
            <Link
              key={href}
              href={href}
              target={external ? '_blank' : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
              style={{
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                fontWeight: active ? 500 : 400,
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; } }}
            >
              <span style={{ opacity: active ? 1 : 0.65, flexShrink: 0 }}>{icon}</span>
              <span className="flex-1">{label}</span>
              {isInbox && handoffCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: '#f59e0b', minWidth: 18, textAlign: 'center' }}
                >
                  {handoffCount}
                </span>
              )}
              {isTasks && taskCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: '#ef4444', minWidth: 18, textAlign: 'center' }}
                >
                  {taskCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
        {/* Logged-in user name */}
        {auth && (
          <div className="px-3 pb-2">
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {auth.name}
            </p>
            <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
              {auth.role}
            </p>
          </div>
        )}

        <Link
          href="/chat"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
        >
          <span style={{ opacity: 0.65, flexShrink: 0 }}><IconExternalLink size={16} /></span>
          WhatsApp Bot
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <span style={{ opacity: 0.65, flexShrink: 0 }}><IconLogOut size={16} /></span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f5f3' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
