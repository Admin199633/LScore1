'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { FuturisticSpinner } from './PageSpinner';

export function NavigationLoader() {
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement>(null);

  // When pathname changes — new page mounted, hide overlay
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.style.display = 'none';
    }
  }, [pathname]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const show = (e: Event) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (
        anchor &&
        anchor.href &&
        anchor.origin === window.location.origin &&
        !anchor.href.includes('#') &&
        anchor.pathname !== window.location.pathname
      ) {
        // Direct DOM manipulation — synchronous, no React re-render needed
        overlay.style.display = 'flex';
      }
    };

    document.addEventListener('touchstart', show, { passive: true });
    document.addEventListener('click', show);

    return () => {
      document.removeEventListener('touchstart', show);
      document.removeEventListener('click', show);
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        display: 'none',
        position: 'fixed',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        zIndex: 200,
      }}
    >
      <FuturisticSpinner />
    </div>
  );
}
