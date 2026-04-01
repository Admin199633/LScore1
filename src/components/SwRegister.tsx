'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    // Dismiss the initial HTML loader
    const loader = document.getElementById('app-initial-loader');
    if (loader) {
      loader.style.transition = 'opacity 0.25s ease';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 250);
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}
