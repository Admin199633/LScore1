'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@/lib/session';

export function ProtectedPage({
  children,
  allowIncompleteOnboarding = false,
}: {
  children: React.ReactNode;
  allowIncompleteOnboarding?: boolean;
}) {
  const router = useRouter();
  const { isLoading, isOnboardingLoading, session, hasOnboarding } = useSessionContext();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/auth');
    }
  }, [isLoading, router, session]);

  useEffect(() => {
    if (!isLoading && !isOnboardingLoading && session && !hasOnboarding && !allowIncompleteOnboarding) {
      router.replace('/onboarding');
    }
  }, [allowIncompleteOnboarding, hasOnboarding, isLoading, isOnboardingLoading, router, session]);

  if (isLoading || isOnboardingLoading || !session) {
    return null;
  }

  if (!allowIncompleteOnboarding && !hasOnboarding) {
    return null;
  }

  return <>{children}</>;
}
