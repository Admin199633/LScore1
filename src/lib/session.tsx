'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getCurrentSession, onAuthStateChange, signOut as authSignOut } from '@/lib/auth';
import { isOnboardingComplete, loadOnboardingData } from '@/lib/onboarding';

type SessionContextValue = {
  isLoading: boolean;
  isOnboardingLoading: boolean;
  session: Session | null;
  user: User | null;
  hasOnboarding: boolean;
  refreshOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  isLoading: true,
  isOnboardingLoading: true,
  session: null,
  user: null,
  hasOnboarding: false,
  refreshOnboarding: async () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const isHydratingRef = useRef(false); // prevents concurrent hydration calls

  useEffect(() => {
    let isMounted = true;
    const CACHE_KEY = 'gym_onboarding_complete';

    const hydrateOnboarding = async (nextSession: Session | null) => {
      if (!isMounted) return;

      // Rule 4: null session → clear state directly, no Supabase calls
      if (!nextSession) {
        sessionStorage.removeItem(CACHE_KEY);
        setHasOnboarding(false);
        setIsOnboardingLoading(false);
        return;
      }

      // Rule 6: already in sessionStorage → apply without touching isOnboardingLoading
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached !== null) {
        setHasOnboarding(cached === 'true');
        setIsOnboardingLoading(false);
        return;
      }

      // Rule 5: prevent concurrent hydration (hydrate() vs INITIAL_SESSION)
      if (isHydratingRef.current) return;
      isHydratingRef.current = true;
      setIsOnboardingLoading(true);

      try {
        const onboardingData = await loadOnboardingData();
        const complete = isOnboardingComplete(onboardingData);
        if (isMounted) {
          sessionStorage.setItem(CACHE_KEY, String(complete));
          setHasOnboarding(complete);
        }
      } catch {
        if (isMounted) setHasOnboarding(false);
      } finally {
        isHydratingRef.current = false;
        if (isMounted) setIsOnboardingLoading(false);
      }
    };

    const hydrate = async () => {
      try {
        const currentSession = await getCurrentSession();
        if (isMounted) setSession(currentSession);
        await hydrateOnboarding(currentSession);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    hydrate();

    const { data } = onAuthStateChange(async (event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsLoading(false);
      }

      if (event === 'SIGNED_OUT') {
        // Rule 4: clear state directly without calling hydrateOnboarding
        if (isMounted) {
          sessionStorage.removeItem(CACHE_KEY);
          setHasOnboarding(false);
          setIsOnboardingLoading(false);
        }
        return;
      }

      // Rules 1-3: only hydrate on SIGNED_IN — skip TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
      if (event === 'SIGNED_IN') {
        await hydrateOnboarding(nextSession);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshOnboarding = async () => {
    if (!session) {
      setHasOnboarding(false);
      setIsOnboardingLoading(false);
      return;
    }

    sessionStorage.removeItem('gym_onboarding_complete');
    setIsOnboardingLoading(true);
    try {
      const onboardingData = await loadOnboardingData();
      const complete = isOnboardingComplete(onboardingData);
      sessionStorage.setItem('gym_onboarding_complete', String(complete));
      setHasOnboarding(complete);
    } finally {
      setIsOnboardingLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      isLoading,
      isOnboardingLoading,
      session,
      user: session?.user || null,
      hasOnboarding,
      refreshOnboarding,
      signOut: authSignOut,
    }),
    [hasOnboarding, isLoading, isOnboardingLoading, session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSessionContext = () => useContext(SessionContext);
