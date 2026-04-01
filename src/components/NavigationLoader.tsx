'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FuturisticSpinner } from './PageSpinner';

export function NavigationLoader() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const [isLoading, setIsLoading] = useState(false);

  // When pathname changes — new page is ready, hide spinner
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    const show = (e: Event) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (
        anchor &&
        anchor.href &&
        anchor.origin === window.location.origin &&
        !anchor.href.includes('#') &&
        anchor.pathname !== window.location.pathname
      ) {
        setIsLoading(true);
      }
    };

    document.addEventListener('touchstart', show, { passive: true });
    document.addEventListener('click', show);

    return () => {
      document.removeEventListener('touchstart', show);
      document.removeEventListener('click', show);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        zIndex: 100,
      }}
    >
      <FuturisticSpinner />
    </div>
  );
}
