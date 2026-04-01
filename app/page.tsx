'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@/lib/session';

export default function RootPage() {
  const router = useRouter();
  const { isLoading, isOnboardingLoading, session, hasOnboarding } = useSessionContext();

  useEffect(() => {
    if (isLoading || isOnboardingLoading) {
      return;
    }

    router.replace(!session ? '/auth' : hasOnboarding ? '/home' : '/onboarding');
  }, [hasOnboarding, isLoading, isOnboardingLoading, router, session]);

  return null;
}
