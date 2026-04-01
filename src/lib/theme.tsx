'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const WEB_THEMES = {
  dark: {
    mode: 'dark',
    background: '#121212',
    surface: '#1E1E1E',
    surface2: '#242424',
    text: '#FFFFFF',
    textMuted: '#A0A0A0',
    accent: '#FF6B00',
    border: '#2D2D2D',
    danger: '#FFB3B3',
    dangerBg: '#2A1717',
    success: '#A7E0BC',
    successBg: '#18221A',
  },
  light: {
    mode: 'light',
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surface2: '#F1F3F5',
    text: '#121212',
    textMuted: '#6F6F6F',
    accent: '#FF6B00',
    border: '#E2E2E2',
    danger: '#9F2D2D',
    dangerBg: '#FFF1F1',
    success: '#176949',
    successBg: '#ECFAF3',
  },
  ai: {
    mode: 'dark',
    background: '#050c1f',
    surface: 'rgba(11, 18, 45, 0.95)',
    surface2: 'rgba(14, 24, 58, 0.95)',
    text: '#f5fbff',
    textMuted: '#9fbce6',
    accent: '#7af3ff',
    border: 'rgba(122, 243, 255, 0.35)',
    danger: '#ff5c8a',
    dangerBg: 'rgba(106, 12, 34, 0.55)',
    success: '#6bffde',
    successBg: 'rgba(10, 45, 40, 0.7)',
  },
  clean: {
    mode: 'light',
    background: '#f7f8fb',
    surface: '#ffffff',
    surface2: '#f0f2f5',
    text: '#0b1428',
    textMuted: '#6f7c95',
    accent: '#2e7dff',
    border: '#d8e2f0',
    danger: '#ff4f6d',
    dangerBg: '#ffedf1',
    success: '#0f9d58',
    successBg: '#e6f7ef',
  },
  fitness: {
    mode: 'dark',
    background: '#07090f',
    surface: '#11151f',
    surface2: '#192035',
    text: '#ffffff',
    textMuted: '#b1b4c1',
    accent: '#ff3e3e',
    border: 'rgba(255, 62, 62, 0.4)',
    danger: '#ffb347',
    dangerBg: 'rgba(255, 179, 71, 0.25)',
    success: '#7dfc9a',
    successBg: 'rgba(125, 252, 154, 0.25)',
  },
  dashboard: {
    mode: 'light',
    background: '#f0f3f6',
    surface: '#ffffff',
    surface2: '#e5ebf0',
    text: '#102039',
    textMuted: '#57738f',
    accent: '#00bfa5',
    border: '#d5e1ea',
    danger: '#ff6b6b',
    dangerBg: '#ffecec',
    success: '#1a936f',
    successBg: '#e8f7f3',
  },
} as const;

export type ThemePreference = keyof typeof WEB_THEMES;

type ThemeContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
};

const STORAGE_KEY = 'web-theme-preference';

const ThemeContext = createContext<ThemeContextValue>({
  themePreference: 'dark',
  setThemePreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('dark');

  useEffect(() => {
    const storedValue =
      typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : '';

    if (storedValue && storedValue in WEB_THEMES) {
      setThemePreferenceState(storedValue as ThemePreference);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.theme = themePreference;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, themePreference);
    }
  }, [themePreference]);

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference: (nextValue: ThemePreference) => {
        if (nextValue in WEB_THEMES) {
          setThemePreferenceState(nextValue);
        }
      },
    }),
    [themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
