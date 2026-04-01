'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@/lib/session';
import { PageSpinner } from '@/components/PageSpinner';

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
    return <PageSpinner />;
  }

  if (!allowIncompleteOnboarding && !hasOnboarding) {
    return <PageSpinner />;
  }

  return <>{children}</>;
}
