'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  getWorkoutSessionById,
  type SavedWorkoutSession,
} from '@/lib/repositories/workoutSessionRepository';

export default function EditWorkoutSessionPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [session, setSession] = useState<SavedWorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setError('מזהה אימון חסר.');
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError('');

    getWorkoutSessionById(id)
      .then((s) => {
        if (!isMounted) return;
        setSession(s);
        if (!s) setError('האימון לא נמצא.');
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'טעינת האימון נכשלה.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [id]);

  return (
    <ProtectedPage>
      <div style={{ display: 'grid', gap: 16 }}>
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>עריכת אימון</div>

          {isLoading ? (
            <div style={{ color: 'var(--text-muted)' }}>טוען...</div>
          ) : error ? (
            <div style={{ color: 'var(--danger)' }}>{error}</div>
          ) : session ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{session.date}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>{session.dayName || 'ללא שם יום'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                {session.exercises.filter((ex) => ex.sets.length > 0).length} תרגילים ·{' '}
                {session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)} סטים
              </div>
            </>
          ) : null}
        </div>

        {!isLoading && !error && session ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 20,
              display: 'grid',
              gap: 8,
              color: 'var(--text-muted)',
              fontSize: 15,
            }}
          >
            עריכת נתוני האימון תהיה זמינה בקרוב.
          </div>
        ) : null}

        <Link href="/workout-history" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          חזרה להיסטוריה
        </Link>
      </div>
    </ProtectedPage>
  );
}
