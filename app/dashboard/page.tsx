'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconTrendingUp, IconUsers, IconAlertCircle,
  IconMessage, IconBook, IconArrowRight,
} from '@/app/dashboard/components/Icons';

type Stats = {
  totalLeads: number;
  newLeads: number;
  handoffs: number;
  totalConversations: number;
  kbDocs: number;
};

type StatCardProps = {
  label: string;
  value: number | null;
  sub?: string;
  href?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
};

function StatCard({ label, value, sub, href, icon, iconBg, iconColor }: StatCardProps) {
  const inner = (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        {href && (
          <span className="text-gray-300 group-hover:text-gray-500 transition-colors">
            <IconArrowRight size={14} />
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-gray-900 tracking-tight">
        {value === null ? <span className="text-gray-300">—</span> : value}
      </p>
      <p className="text-xs font-medium text-gray-500 mt-0.5 uppercase tracking-wide">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const QUICK_LINKS = [
  {
    href: '/dashboard/leads',
    icon: <IconTrendingUp size={20} />,
    iconBg: '#f0f9f7',
    iconColor: '#0d3b33',
    title: 'Leads & CRM',
    desc: 'View and update lead status, callbacks, event registrations',
  },
  {
    href: '/dashboard/conversations',
    icon: <IconMessage size={20} />,
    iconBg: '#fef9ec',
    iconColor: '#92400e',
    title: 'Conversations',
    desc: 'Review all chats and respond to handoffs requiring attention',
  },
  {
    href: '/dashboard/kb',
    icon: <IconBook size={20} />,
    iconBg: '#f5f3ff',
    iconColor: '#6d28d9',
    title: 'Knowledge Base',
    desc: 'Upload and manage FAQ documents for the AI bot',
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then(setStats);
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight font-display">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">Nwealth Capital · WhatsApp AI Dashboard</p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        <StatCard
          label="New Leads"
          value={stats?.newLeads ?? null}
          sub="Awaiting follow-up"
          href="/dashboard/leads"
          icon={<IconAlertCircle size={16} />}
          iconBg="#fff3cd"
          iconColor="#7c4a03"
        />
        <StatCard
          label="Total Leads"
          value={stats?.totalLeads ?? null}
          sub="All time"
          href="/dashboard/leads"
          icon={<IconTrendingUp size={16} />}
          iconBg="#f0f9f7"
          iconColor="#0d3b33"
        />
        <StatCard
          label="Handoffs"
          value={stats?.handoffs ?? null}
          sub="Need attention"
          href="/dashboard/conversations"
          icon={<IconMessage size={16} />}
          iconBg="#fef3c7"
          iconColor="#92400e"
        />
        <StatCard
          label="Conversations"
          value={stats?.totalConversations ?? null}
          sub="Total sessions"
          href="/dashboard/conversations"
          icon={<IconUsers size={16} />}
          iconBg="#f0f9f7"
          iconColor="#1a7a6e"
        />
        <StatCard
          label="KB Documents"
          value={stats?.kbDocs ?? null}
          sub="Indexed"
          href="/dashboard/kb"
          icon={<IconBook size={16} />}
          iconBg="#f5f3ff"
          iconColor="#6d28d9"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map(({ href, icon, iconBg, iconColor, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group flex gap-4 items-start"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: iconBg, color: iconColor }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 text-sm">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <span className="text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5 flex-shrink-0">
              <IconArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
