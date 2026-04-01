import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { SessionProvider } from '@/lib/session';
import { ThemeProvider } from '@/lib/theme';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SwRegister } from '@/components/SwRegister';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0db899',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Gym Tracker',
  description: 'אפליקציית מעקב כושר אישית',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Gym',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={poppins.className}>
      <body>
        {/* Fallback: remove loader after 6s if React fails to mount */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){var e=document.getElementById('app-initial-loader');if(e)e.remove();},6000)` }} />

        {/* Initial loader — rendered by server, visible before React hydrates */}
        <div
          id="app-initial-loader"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#111111',
            zIndex: 9999,
          }}
        >
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2.5px solid transparent',
              borderTopColor: '#0db899', borderRightColor: '#0db899',
              boxShadow: '0 0 14px rgba(13,184,153,0.5)',
              animation: 'spin 1.1s cubic-bezier(0.4,0,0.2,1) infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 10, borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#b8a8ff', borderLeftColor: '#b8a8ff',
              boxShadow: '0 0 10px rgba(184,168,255,0.4)',
              animation: 'spin 0.8s linear infinite reverse',
            }} />
            <div style={{
              position: 'absolute', inset: 24, borderRadius: '50%',
              background: '#0db899',
              boxShadow: '0 0 12px rgba(13,184,153,0.8)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>

        <ThemeProvider>
          <SessionProvider>
            <AppShell>{children}</AppShell>
            <SpeedInsights />
          </SessionProvider>
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
