'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = {
  value: string;
  label: string;
  bg?: string;
  color?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  pill?: boolean;
};

type PanelPos = { top?: number; bottom?: number; left: number; width: number };

export function CustomSelect({ value, options, onChange, disabled = false, pill = false }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? options[0];

  const handleOpen = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const panelH = options.length * 40 + 8;
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < panelH) {
        setPos({ bottom: window.innerHeight - r.top + 6, left: r.right, width: r.width });
      } else {
        setPos({ top: r.bottom + 6, left: r.right, width: r.width });
      }
    }
    setOpen((o) => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && triggerRef.current.contains(e.target as Node)
      ) return;
      if (
        panelRef.current && panelRef.current.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const panelH = options.length * 40 + 8;
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < panelH) {
        setPos({ bottom: window.innerHeight - r.top + 6, left: r.right, width: r.width });
      } else {
        setPos({ top: r.bottom + 6, left: r.right, width: r.width });
      }
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, options.length]);

  const triggerStyle = pill && current.bg
    ? { backgroundColor: current.bg, color: current.color ?? '#1f2937', border: 'none', padding: '4px 12px' }
    : { backgroundColor: '#fff', color: '#1f2937', border: '1px solid #e5e7eb', padding: '7px 12px' };

  const panel = open && pos ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        bottom: pos.bottom,
        // right-align: shift left by panel width (estimated 160px) from the right edge of trigger
        left: pos.left - 160,
        minWidth: Math.max(pos.width, 140),
        width: 'max-content',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
            style={{
              backgroundColor: isSelected ? '#0d3b33' : 'transparent',
              color: isSelected ? '#fff' : '#1f2937',
              fontWeight: isSelected ? 600 : 400,
            }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f0f9f7'; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : (opt.color ?? opt.bg ?? '#ccc') }}
            />
            {opt.label}
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-xl text-sm font-semibold outline-none cursor-pointer"
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span>{current.label}</span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {panel}
    </>
  );
}
