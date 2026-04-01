'use client';

import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/ProtectedPage';
import { PageSpinner } from '@/components/PageSpinner';
import { fetchCurrentProfile } from '@/lib/repositories/profileRepository';
import { fetchLatestBodyweight } from '@/lib/repositories/bodyweightRepository';

type ProfileData = {
  age: number;
  height: number;
  gender: string;
  goal: string;
  weight: number;
};

const calculateBMR = ({ weight, height, age, gender }: ProfileData): number | null => {
  if (!weight || !height || !age) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
};

const getMissingFields = ({ weight, height, age, gender }: ProfileData): string[] => {
  const missing = [];
  if (!weight) missing.push('משקל');
  if (!height) missing.push('גובה');
  if (!age) missing.push('גיל');
  if (!gender) missing.push('מגדר');
  return missing;
};

export default function ReportsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [profileData, latestBodyweight] = await Promise.all([
          fetchCurrentProfile(),
          fetchLatestBodyweight().catch(() => null),
        ]);
        if (!isMounted) return;
        setProfile({
          age: profileData?.age || 0,
          height: profileData?.height || 0,
          gender: (profileData as any)?.gender || '',
          goal: profileData?.goal || '',
          weight: latestBodyweight?.weight || 0,
        });
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'טעינת הנתונים נכשלה.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return <ProtectedPage><PageSpinner /></ProtectedPage>;
  }

  const bmr = profile ? calculateBMR(profile) : null;
  const missingFields = profile ? getMissingFields(profile) : [];

  return (
    <ProtectedPage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 20 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>דוחות</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>נתונים אישיים</div>
        </div>

        {error ? (
          <div style={{ color: 'var(--danger)', fontSize: 14, padding: '0 4px' }}>{error}</div>
        ) : null}

        <BmrAccordion bmr={bmr} profile={profile} missingFields={missingFields} />

      </div>
    </ProtectedPage>
  );
}

function BmrAccordion({
  bmr,
  profile,
  missingFields,
}: {
  bmr: number | null;
  profile: ProfileData | null;
  missingFields: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>BMR — קצב מטבולי בסיסי</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            {bmr !== null ? `${Math.round(bmr)} קק"ל / יום` : 'חסרים נתונים'}
          </div>
        </div>
        <span style={{
          fontSize: 18,
          color: 'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}>
          ▾
        </span>
      </button>

      {open ? (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            כמה קלוריות הגוף שורף במנוחה מוחלטת. מחושב לפי נוסחת Mifflin-St Jeor.
          </div>

          {bmr !== null && profile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 52, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                  {Math.round(bmr)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 6 }}>קק"ל / יום</span>
              </div>

              <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>פירוט החישוב</div>
                <FormulaRow label="משקל" value={`10 × ${profile.weight} = ${10 * profile.weight}`} />
                <FormulaRow label="גובה" value={`6.25 × ${profile.height} = ${6.25 * profile.height}`} />
                <FormulaRow label="גיל" value={`5 × ${profile.age} = ${5 * profile.age}`} />
                <FormulaRow label="מגדר" value={profile.gender === 'female' ? '−161 (נקבה)' : '+5 (זכר)'} />
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800 }}>סה"כ</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{Math.round(bmr)} קק"ל</span>
                </div>
              </div>

              <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>מה זה אומר? (TDEE)</div>
                <InterpretRow label="מנוחה מוחלטת" multiplier={1} bmr={bmr} />
                <InterpretRow label="פעילות קלה (1–3 ימי אימון)" multiplier={1.375} bmr={bmr} />
                <InterpretRow label="פעילות בינונית (3–5 ימים)" multiplier={1.55} bmr={bmr} />
                <InterpretRow label="פעילות גבוהה (6–7 ימים)" multiplier={1.725} bmr={bmr} />
              </div>
            </>
          ) : (
            <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>חסרים נתונים לחישוב</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                יש להשלים בדף הפרופיל: {missingFields.join(', ')}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FormulaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function InterpretRow({ label, multiplier, bmr }: { label: string; multiplier: number; bmr: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, marginLeft: 8 }}>{label}</span>
      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Math.round(bmr * multiplier)} קק"ל</span>
    </div>
  );
}
