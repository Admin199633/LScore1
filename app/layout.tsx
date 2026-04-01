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
  icons: {
    apple: '/icons/icon-192.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={poppins.className}>
      <body>
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
