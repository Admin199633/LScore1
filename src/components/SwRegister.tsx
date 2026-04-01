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

    if (!('serviceWorker' in navigator)) return;

    // Unregister all old service workers, then register fresh
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      Promise.all(registrations.map((r) => r.unregister())).then(() => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    });
  }, []);

  return null;
}
