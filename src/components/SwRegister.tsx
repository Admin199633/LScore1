'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed silently — app still works normally
      });
    }
  }, []);

  return null;
}
