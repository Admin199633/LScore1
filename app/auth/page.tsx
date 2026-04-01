'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { useSessionContext } from '@/lib/session';

export default function AuthPage() {
  const router = useRouter();
  const { isLoading, isOnboardingLoading, session, hasOnboarding } = useSessionContext();

  useEffect(() => {
    if (!isLoading && !isOnboardingLoading && session) {
      router.replace(hasOnboarding ? '/home' : '/onboarding');
    }
  }, [hasOnboarding, isLoading, isOnboardingLoading, router, session]);

  return <AuthForm />;
}
