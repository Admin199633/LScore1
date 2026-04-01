'use client';

import { useEffect } from 'react';

export function AppReady() {
  useEffect(() => {
    const el = document.getElementById('app-initial-loader');
    if (!el) return;
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, []);

  return null;
}
