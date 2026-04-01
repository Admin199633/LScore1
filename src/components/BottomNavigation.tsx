'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const c = (active: boolean) => (active ? '#0a0a0a' : 'rgba(0,0,0,0.45)');

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-8.5z" stroke={c(active)} strokeWidth="1.8" />
    <path d="M9 21v-7h6v7" stroke={c(active)} strokeWidth="1.8" />
  </svg>
);

const NutritionIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 2v7c0 1.38 1.12 2.5 2.5 2.5S11.5 10.38 11.5 9V2" stroke={c(active)} strokeWidth="1.8" />
    <path d="M9 2v20" stroke={c(active)} strokeWidth="1.8" />
    <path d="M16 2c0 0 3 2.5 3 7s-3 6-3 6v7a1 1 0 01-2 0V2" stroke={c(active)} strokeWidth="1.8" />
  </svg>
);

const WorkoutIcon = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 8v8M17.5 8v8" stroke={active ? '#fff' : 'rgba(255,255,255,0.9)'} strokeWidth="2.2" />
    <path d="M6.5 12h11" stroke={active ? '#fff' : 'rgba(255,255,255,0.9)'} strokeWidth="2.2" />
    <path d="M2.5 9.5h4M17.5 9.5H21.5M2.5 14.5h4M17.5 14.5H21.5"
      stroke={active ? '#fff' : 'rgba(255,255,255,0.9)'} strokeWidth="1.8" />
  </svg>
);

const ReportsIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V13" stroke={c(active)} strokeWidth="1.8" />
    <path d="M9 20V8" stroke={c(active)} strokeWidth="1.8" />
    <path d="M14 20v-5" stroke={c(active)} strokeWidth="1.8" />
    <path d="M19 20V4" stroke={c(active)} strokeWidth="1.8" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7.5" r="3.5" stroke={c(active)} strokeWidth="1.8" />
    <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke={c(active)} strokeWidth="1.8" />
  </svg>
);

const navItems = [
  { href: '/home',      label: 'בית',    Icon: HomeIcon      },
  { href: '/nutrition', label: 'תזונה',  Icon: NutritionIcon },
  { href: '/workout',   label: 'אימון',  Icon: WorkoutIcon, center: true },
  { href: '/reports',   label: 'דוחות',  Icon: ReportsIcon   },
  { href: '/profile',   label: 'פרופיל', Icon: ProfileIcon   },
];

export function BottomNavigation() {
  const pathname = usePathname() || '/home';
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      <nav style={{
        pointerEvents: 'all',
        background: 'linear-gradient(135deg, #a8eddc 0%, #d4ccff 100%)',
        borderRadius: 999,
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
      }}>
        {navItems.map(({ href, label, Icon, center }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              style={{
                display: 'grid',
                placeItems: 'center',
                width:  center ? 54 : 42,
                height: center ? 54 : 42,
                borderRadius: '50%',
                background: center
                  ? active ? '#0a0a0a' : '#111111'
                  : active
                    ? 'rgba(0,0,0,0.10)'
                    : 'transparent',
                opacity: center ? 1 : active ? 1 : 0.55,
                transform: active && !center ? 'scale(1.12)' : 'scale(1)',
                transition: 'opacity 0.18s, transform 0.18s, background 0.18s',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <Icon active={active} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
