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
    return <PageLoader />;
  }

  if (!allowIncompleteOnboarding && !hasOnboarding) {
    return <PageLoader />;
  }

  return <>{children}</>;
}

function PageLoader() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid var(--surface-2)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.75s linear infinite',
        }}
      />
    </div>
  );
}
