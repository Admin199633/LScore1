'use client';

import { useEffect, useState } from 'react';

const ENABLED_KEY = 'gym-workout-vibration-enabled';
const INTERVAL_KEY = 'gym-workout-vibration-interval-seconds';

export const VIBRATION_INTERVAL_OPTIONS = [30, 45, 60, 90, 120] as const;
export type VibrationInterval = (typeof VIBRATION_INTERVAL_OPTIONS)[number];

const DEFAULT_INTERVAL: VibrationInterval = 60;

export function useVibrationSettings() {
  const [enabled, setEnabledState] = useState(false);
  const [intervalSeconds, setIntervalSecondsState] = useState<VibrationInterval>(DEFAULT_INTERVAL);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedEnabled = window.localStorage.getItem(ENABLED_KEY);
    const storedInterval = window.localStorage.getItem(INTERVAL_KEY);

    if (storedEnabled === 'true') setEnabledState(true);

    if (storedInterval) {
      const parsed = parseInt(storedInterval, 10);
      if ((VIBRATION_INTERVAL_OPTIONS as readonly number[]).includes(parsed)) {
        setIntervalSecondsState(parsed as VibrationInterval);
      }
    }
  }, []);

  const setEnabled = (value: boolean) => {
    setEnabledState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ENABLED_KEY, String(value));
    }
  };

  const setIntervalSeconds = (value: VibrationInterval) => {
    setIntervalSecondsState(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INTERVAL_KEY, String(value));
    }
  };

  return { enabled, setEnabled, intervalSeconds, setIntervalSeconds };
}
