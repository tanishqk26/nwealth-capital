type IconProps = { size?: number; className?: string; strokeWidth?: number };

const base = (d: string, { size = 18, className = '', strokeWidth = 1.6 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {d.split('|').map((path, i) => <path key={i} d={path} />)}
  </svg>
);

export const IconHome       = (p: IconProps) => base('M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H14v-6h-4v6H4a1 1 0 01-1-1V9.5z', p);
export const IconUsers      = (p: IconProps) => base('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2|M9 11a4 4 0 100-8 4 4 0 000 8z|M23 21v-2a4 4 0 00-3-3.87|M16 3.13a4 4 0 010 7.75', p);
export const IconUser       = (p: IconProps) => base('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2|M12 11a4 4 0 100-8 4 4 0 000 8z', p);
export const IconMessage    = (p: IconProps) => base('M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', p);
export const IconBook       = (p: IconProps) => base('M4 19.5A2.5 2.5 0 016.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z', p);
export const IconLogOut     = (p: IconProps) => base('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4|M16 17l5-5-5-5|M21 12H9', p);
export const IconExternalLink = (p: IconProps) => base('M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6|M15 3h6v6|M10 14L21 3', p);
export const IconTrendingUp = (p: IconProps) => base('M23 6l-9.5 9.5-5-5L1 18|M17 6h6v6', p);
export const IconAlertCircle = (p: IconProps) => base('M12 22a10 10 0 100-20 10 10 0 000 20z|M12 8v4|M12 16h.01', p);
export const IconChevronLeft = (p: IconProps) => base('M15 18l-6-6 6-6', p);
export const IconArrowRight = (p: IconProps) => base('M5 12h14|M12 5l7 7-7 7', p);
export const IconCheck      = (p: IconProps) => base('M20 6L9 17l-5-5', p);
export const IconPhone      = (p: IconProps) => base('M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z', p);
export const IconSearch     = (p: IconProps) => base('M11 19a8 8 0 100-16 8 8 0 000 16z|M21 21l-4.35-4.35', p);
export const IconFileText   = (p: IconProps) => base('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8', p);
export const IconInbox      = (p: IconProps) => base('M22 12h-6l-2 3h-4l-2-3H2|M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z', p);
