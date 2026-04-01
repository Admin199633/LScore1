import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { SessionProvider } from '@/lib/session';
import { ThemeProvider } from '@/lib/theme';
import { SpeedInsights } from "@vercel/speed-insights/next"; // 👈 פה למעלה

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Gym Web',
  description: 'Web client for the Gym app',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={poppins.className}>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <AppShell>{children}</AppShell>
            <SpeedInsights /> {/* 👈 פה */}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}