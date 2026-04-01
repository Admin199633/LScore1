'use client';

import { BottomNavigation } from './BottomNavigation';
import { NavigationLoader } from './NavigationLoader';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        width: '100%',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          padding: 16,
          paddingBottom: 96,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
      <BottomNavigation />
      <NavigationLoader />
    </main>
  );
}
