'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabConfig: Array<{ label: string; href: Route }> = [
  { label: 'בית', href: '/home' },
  { label: 'יומן אימונים', href: '/workout' },
  { label: 'חלבון', href: '/nutrition' },
];

const titleMap: Record<string, string> = {
  '/home': 'בית',
  '/nutrition': 'תזונה',
  '/nutrition-history': 'היסטוריית תזונה',
  '/workout': 'אימון',
  '/workout-history': 'היסטוריית אימונים',
  '/profile': 'פרופיל',
};

export function TopNavigation() {
  const pathname = usePathname() || '/home';
  const pageTitle = titleMap[pathname] || 'בית';

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href !== '/' && pathname.startsWith(href));

  return (
    <div style={{ background: 'var(--surface)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{pageTitle}</div>
        <Link
          href="/profile"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--surface-2)',
            display: 'grid',
            placeItems: 'center',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700 }}>פר</span>
        </Link>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 12,
          flexWrap: 'wrap-reverse',
          justifyContent: 'space-between',
        }}
      >
        {tabConfig.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '8px 14px',
              borderRadius: 16,
              background: isActive(tab.href) ? 'var(--accent)' : 'var(--surface-2)',
              color: '#fff',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}