'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  calculateNutritionFromText,
  type NutritionCalculationResult,
} from '@shared-engines/proteinEngine';
import { proteinFoods, type ProteinFoodEntry } from '@shared-engines/proteinFoods';
import { ProtectedPage } from '@/components/ProtectedPage';
import { appendNutritionLog, saveNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import { listUserFoods } from '@/lib/repositories/userFoodRepository';
import { mapUserFoodsToEntries } from '@/lib/userFoodMapper';
import { parseRecoveryParam } from '@/lib/recoveryContext';
import { RecoveryBanner } from '@/components/RecoveryBanner';

const EXAMPLE_INPUT = [''].join('\n');
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const formatMacro = (value?: number | null, suffix = '') =>
  value == null ? '-' : `${value.toFixed(1)}${suffix}`;

const getResultStatus = (results: NutritionCalculationResult) => {
  if (results.unresolvedCount > 0) {
    return {
      label: `החישוב הושלם חלקית — ${results.unresolvedCount} פריטים לא פתורים`,
      tone: 'warn',
    };
  }

  if (results.hasPartialNutrition) {
    return {
      label: 'החישוב הושלם אך למספר פריטים יש נתונים חלקיים',
      tone: 'info',
    };
  }

  return {
    label: 'החישוב הושלם בהצלחה',
    tone: 'success',
  };
};

function NutritionPageContent() {
  const searchParams = useSearchParams();
  const recoveryType = parseRecoveryParam(searchParams.get('recovery'));
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState(EXAMPLE_INPUT);
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [results, setResults] = useState<NutritionCalculationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [userFoodEntries, setUserFoodEntries] = useState<ProteinFoodEntry[]>([]);

  const unresolvedItems = useMemo(
    () => results?.items.filter((item) => item.status === 'unresolved') ?? [],
    [results]
  );
  const unresolvedPreview = useMemo(() => unresolvedItems.slice(0, 2), [unresolvedItems]);
  const resultStatus = useMemo(() => (results ? getResultStatus(results) : null), [results]);

  useEffect(() => {
    if (recoveryType === 'nutrition' && !recoveryDismissed) {
      textareaRef.current?.focus();
    }
  }, [recoveryType, recoveryDismissed]);

  useEffect(() => {
    listUserFoods()
      .then((rows) => setUserFoodEntries(mapUserFoodsToEntries(rows)))
      .catch(() => {}); // silent fail — falls back to JSON foods only
  }, []);

  const mergedFoods = useMemo<ProteinFoodEntry[]>(
    () => (userFoodEntries.length > 0 ? [...userFoodEntries, ...proteinFoods] : proteinFoods),
    [userFoodEntries]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveMessage('');
    setSaveError('');
    setResults(calculateNutritionFromText(input, mergedFoods));
  };

  const buildNutritionLogInput = () => ({
    date: selectedDate,
    rawInputText: input,
    totalProteinGrams: results!.totalProteinGrams,
    totalCalories: results!.totals.calories ?? null,
    totalCarbs: results!.totals.carbs ?? null,
    totalFat: results!.totals.fat ?? null,
    items: results!.items.map((item) => ({
      originalText: item.originalText,
      displayName: item.name || item.originalText,
      proteinGrams: item.nutrition.protein ?? null,
      calories: item.nutrition.calories ?? null,
      carbs: item.nutrition.carbs ?? null,
      fat: item.nutrition.fat ?? null,
      status: item.status,
      reason: item.reason,
    })),
  });

  const handleSave = async () => {
    if (!results) return;
    setIsSaving(true);
    setSaveMessage('');
    setSaveError('');
    try {
      await saveNutritionLog(buildNutritionLogInput());
      setSaveMessage('יומן התזונה נשמר.');
      setRecoveryDismissed(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'שמירת יומן התזונה נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppend = async () => {
    if (!results) return;
    setIsSaving(true);
    setSaveMessage('');
    setSaveError('');
    try {
      await appendNutritionLog(buildNutritionLogInput());
      setSaveMessage('הפריטים נוספו ליומן.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'הוספה ליומן התזונה נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedPage>
      <div style={{ display: 'grid', gap: 16 }}>

        {/* כרטיס ראשי — קלט + תוצאות + שמירה */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            gap: 14,
            ...(recoveryType === 'nutrition' && !recoveryDismissed
              ? { outline: '2px solid var(--accent)', outlineOffset: 2 }
              : {}),
          }}
        >
          {recoveryType === 'nutrition' && !recoveryDismissed ? (
            <RecoveryBanner message="חסרים נתוני תזונה מהימים האחרונים. עדכון קצר יעזור לדייק את ההמלצות." />
          ) : null}
          {/* שורת תאריך + כותרת */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>מחשבון תזונה</div>
            <input
              id="nutrition-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: '8px 12px',
                fontSize: 14,
              }}
            />
          </div>

          {/* טקסטאריה */}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <textarea
              ref={textareaRef}
              id="nutrition-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'לדוגמה:\nסלמון 100 גרם\n2 ביצים\nטונה'}
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 12,
                lineHeight: 1.7,
                fontSize: 15,
              }}
            />
            <button
              type="submit"
              style={{
                border: 0,
                borderRadius: 14,
                background: 'var(--accent)',
                color: '#fff',
                padding: '13px 16px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              חשב
            </button>
          </form>

          {/* תוצאות — מופיעות בתוך אותה כרטיסייה */}
          {results ? (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* סה"כ קלוריות + חלבון */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 14,
                    padding: '14px 12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>קלוריות</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{formatMacro(results.totals.calories)}</div>
                </div>
                <div
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 14,
                    padding: '14px 12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>חלבון</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{formatMacro(results.totals.protein)}g</div>
                </div>
              </div>

              {/* פחמימות + שומן קטן */}
              <div style={{ display: 'flex', gap: 16, fontSize: 14, color: 'var(--text-muted)' }}>
                <span>פחמימות: {formatMacro(results.totals.carbs)}g</span>
                <span>שומן: {formatMacro(results.totals.fat)}g</span>
              </div>

              {/* שגיאות — בולטות */}
              {unresolvedItems.length > 0 ? (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>
                    ⚠️ {unresolvedItems.length} פריטים לא זוהו:
                  </div>
                  {unresolvedItems.map((item, index) => (
                    <div key={index} style={{ fontSize: 13, color: 'var(--danger)' }}>
                      • {item.originalText}{item.reason ? ` — ${item.reason}` : ''}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* כפתורי שמירה */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleAppend}
                  disabled={isSaving}
                  style={{
                    border: 0,
                    borderRadius: 14,
                    background: 'var(--accent)',
                    color: '#fff',
                    padding: '13px 8px',
                    fontWeight: 800,
                    cursor: isSaving ? 'default' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    fontSize: 14,
                  }}
                >
                  {isSaving ? '...' : '+ הוסף לרשימה'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    background: 'transparent',
                    color: 'var(--text)',
                    padding: '13px 8px',
                    fontWeight: 800,
                    cursor: isSaving ? 'default' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    fontSize: 14,
                  }}
                >
                  {isSaving ? '...' : 'החלף רשימה'}
                </button>
              </div>

              {saveMessage ? <div style={{ color: 'var(--success)', fontSize: 14 }}>{saveMessage}</div> : null}
              {saveError ? <div style={{ color: 'var(--danger)', fontSize: 14 }}>{saveError}</div> : null}
            </>
          ) : null}
        </div>

        {/* פירוט פריטים — מתקפל */}
        {results ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 20,
              display: 'grid',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setDetailsExpanded((v) => !v)}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--text)',
                padding: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              <span>פירוט פריטים ({results.items.length})</span>
              <span style={{ color: 'var(--text-muted)' }}>{detailsExpanded ? '▲' : '▼'}</span>
            </button>

            {detailsExpanded ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {results.items.map((item, index) => (
                  <div
                    key={`${item.originalText}-${index}`}
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 14,
                      padding: 12,
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name || item.originalText}</div>
                    {item.status === 'calculated' ? (
                      <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>{formatMacro(item.nutrition.calories)} קק"ל</span>
                        <span>חלבון {formatMacro(item.nutrition.protein)}g</span>
                        <span>פח' {formatMacro(item.nutrition.carbs)}g</span>
                        <span>שומן {formatMacro(item.nutrition.fat)}g</span>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--danger)', fontSize: 13 }}>
                        לא פתור{item.reason ? `: ${item.reason}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          <Link href="/nutrition-history" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            היסטוריית תזונה
          </Link>
          <Link href="/home" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            חזרה לבית
          </Link>
        </div>
      </div>
    </ProtectedPage>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={null}>
      <NutritionPageContent />
    </Suspense>
  );
}
