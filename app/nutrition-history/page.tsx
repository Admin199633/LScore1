'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { calculateNutritionFromText } from '@shared-engines/proteinEngine';
import { ProtectedPage } from '@/components/ProtectedPage';
import {
  deleteNutritionLog,
  fetchNutritionLogs,
  saveNutritionLog,
  type SavedNutritionLog,
} from '@/lib/repositories/nutritionLogRepository';

const formatMacro = (value?: number | null, suffix = '') =>
  value == null ? '-' : `${value.toFixed(1)}${suffix}`;

const formatDisplayDate = (value: string) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const buildPreview = (rawInputText: string) =>
  String(rawInputText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ');

const mapEngineItemsToFlat = (
  items: Array<{
    originalText: string;
    name?: string;
    nutrition?: { protein?: number | null; calories?: number | null; carbs?: number | null; fat?: number | null };
    status: 'calculated' | 'unresolved';
    reason?: string;
  }> = []
) =>
  items.map((item) => ({
    originalText: item.originalText,
    displayName: item.name || item.originalText,
    proteinGrams: typeof item.nutrition?.protein === 'number' ? item.nutrition.protein : null,
    calories: typeof item.nutrition?.calories === 'number' ? item.nutrition.calories : null,
    carbs: typeof item.nutrition?.carbs === 'number' ? item.nutrition.carbs : null,
    fat: typeof item.nutrition?.fat === 'number' ? item.nutrition.fat : null,
    status: item.status,
    reason: item.reason || undefined,
  }));

export default function NutritionHistoryPage() {
  const [logs, setLogs] = useState<SavedNutritionLog[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState('');
  const [editingText, setEditingText] = useState('');
  const [editingResults, setEditingResults] = useState<{
    items: SavedNutritionLog['items'];
    totalProteinGrams: number;
    totalCalories: number | null;
    totalCarbs: number | null;
    totalFat: number | null;
    unresolvedCount: number;
  } | null>(null);
  const [lastCalculatedText, setLastCalculatedText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingDate, setIsDeletingDate] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadLogs = async () => {
    const nextLogs = await fetchNutritionLogs();
    setLogs(nextLogs);
    setExpandedDate((current) => current ?? nextLogs[0]?.date ?? null);
    return nextLogs;
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const nextLogs = await fetchNutritionLogs();
        if (isMounted) {
          setLogs(nextLogs);
          setExpandedDate((current) => current ?? nextLogs[0]?.date ?? null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'טעינת ההיסטוריה נכשלה.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const editingLog = useMemo(
    () => logs.find((log) => log.date === editingDate) || null,
    [editingDate, logs]
  );

  const requiresRecalculation = Boolean(editingDate) && editingText !== lastCalculatedText;

  const startEditing = (log: SavedNutritionLog) => {
    setEditingDate(log.date);
    setEditingText(log.rawInputText || '');
    setEditingResults({
      items: log.items || [],
      totalProteinGrams: Number(log.totalProteinGrams || 0),
      totalCalories: log.totalCalories ?? null,
      totalCarbs: log.totalCarbs ?? null,
      totalFat: log.totalFat ?? null,
      unresolvedCount: (log.items || []).filter((item) => item.status === 'unresolved').length,
    });
    setLastCalculatedText(log.rawInputText || '');
    setMessage('');
    setError('');
    setExpandedDate(log.date);
  };

  const cancelEditing = () => {
    setEditingDate('');
    setEditingText('');
    setEditingResults(null);
    setLastCalculatedText('');
    setMessage('');
    setError('');
  };

  const handleRecalculate = () => {
    const nextResults = calculateNutritionFromText(editingText);
    setEditingResults({
      items: mapEngineItemsToFlat(nextResults.items),
      totalProteinGrams: nextResults.totalProteinGrams,
      totalCalories: nextResults.totals?.calories ?? null,
      totalCarbs: nextResults.totals?.carbs ?? null,
      totalFat: nextResults.totals?.fat ?? null,
      unresolvedCount: nextResults.unresolvedCount,
    });
    setLastCalculatedText(editingText);
    setMessage('');
    setError('');
  };

  const handleSaveChanges = async () => {
    if (!editingLog || !editingResults) {
      return;
    }

    if (requiresRecalculation) {
      setError('צריך לחשב מחדש לפני שמירת השינויים.');
      setMessage('');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      await saveNutritionLog({
        date: editingLog.date,
        rawInputText: editingText,
        totalProteinGrams: editingResults.totalProteinGrams || 0,
        totalCalories: editingResults.totalCalories ?? null,
        totalCarbs: editingResults.totalCarbs ?? null,
        totalFat: editingResults.totalFat ?? null,
        items: editingResults.items || [],
      });

      await loadLogs();
      setMessage('השינויים נשמרו בהצלחה.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שמירת השינויים נכשלה.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDay = async (log: SavedNutritionLog) => {
    const confirmed = window.confirm(`למחוק את היומן של ${formatDisplayDate(log.date)}?`);
    if (!confirmed) {
      return;
    }

    setIsDeletingDate(log.date);
    setError('');
    setMessage('');

    try {
      await deleteNutritionLog(log.date);
      const nextLogs = await loadLogs();

      if (editingDate === log.date) {
        cancelEditing();
      }

      if (expandedDate === log.date) {
        setExpandedDate(nextLogs[0]?.date ?? null);
      }

      setMessage('יום התזונה נמחק בהצלחה.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'מחיקת יום התזונה נכשלה.');
    } finally {
      setIsDeletingDate('');
    }
  };

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
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>היסטוריה</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>יומן תזונה שמור</div>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            פתח יום שמור, ערוך את הטקסט, חשב מחדש, שמור שינויים או מחק את היום.
          </div>
        </div>

        {isLoading ? <div style={{ color: 'var(--text-muted)' }}>טוען...</div> : null}
        {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {message ? <div style={{ color: 'var(--success)' }}>{message}</div> : null}

        {editingLog ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 20,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800 }}>{`עריכת יום ${formatDisplayDate(editingLog.date)}`}</div>
            <textarea
              value={editingText}
              onChange={(event) => {
                setEditingText(event.target.value);
                setMessage('');
                setError('');
              }}
              rows={8}
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 14,
                lineHeight: 1.6,
                minHeight: 180,
              }}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={cancelEditing} style={secondaryButtonStyle}>
                בטל
              </button>
              <button type="button" onClick={handleRecalculate} style={secondaryButtonStyle}>
                חשב מחדש
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={requiresRecalculation || isSaving}
                style={primaryButtonStyle(requiresRecalculation || isSaving)}
              >
                {isSaving ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>

            {requiresRecalculation ? (
              <div style={{ color: 'var(--danger)', fontSize: 14 }}>
                נערך טקסט חדש. צריך לחשב מחדש לפני שמירה.
              </div>
            ) : null}

            {editingResults ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  חלבון: {formatMacro(editingResults.totalProteinGrams, ' גרם')}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  קלוריות: {formatMacro(editingResults.totalCalories)} | פחמימות:{' '}
                  {formatMacro(editingResults.totalCarbs, ' גרם')} | שומן:{' '}
                  {formatMacro(editingResults.totalFat, ' גרם')}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  {editingResults.items.length} פריטים, {editingResults.unresolvedCount} לא פתורים
                </div>

                {editingResults.items.map((item, index) => (
                  <div
                    key={`${editingDate}-result-${index}`}
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 16,
                      padding: 14,
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.displayName || item.originalText}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{item.originalText}</div>
                    {item.status === 'calculated' ? (
                      <div style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                        <div>קלוריות: {formatMacro(item.calories)}</div>
                        <div>חלבון: {formatMacro(item.proteinGrams, ' גרם')}</div>
                        <div>פחמימות: {formatMacro(item.carbs, ' גרם')}</div>
                        <div>שומן: {formatMacro(item.fat, ' גרם')}</div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--danger)', fontSize: 14 }}>
                        לא פתור{item.reason ? `: ${item.reason}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && logs.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              padding: 20,
              color: 'var(--text-muted)',
            }}
          >
            אין עדיין יומני תזונה שמורים.
          </div>
        ) : null}

        {logs.map((log) => {
          const isExpanded = expandedDate === log.date;

          return (
            <div
              key={log.date}
              style={{
                background: 'var(--surface)',
                borderRadius: 20,
                padding: 20,
                display: 'grid',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setExpandedDate(isExpanded ? null : log.date)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--text)',
                  padding: 0,
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800 }}>{formatDisplayDate(log.date)}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  {buildPreview(log.rawInputText) || 'ללא תיאור'}
                </div>
              </button>

              <div style={{ display: 'grid', gap: 4, fontSize: 15 }}>
                <div>קלוריות: {formatMacro(log.totalCalories)}</div>
                <div>חלבון: {formatMacro(log.totalProteinGrams, ' גרם')}</div>
                <div>פחמימות: {formatMacro(log.totalCarbs, ' גרם')}</div>
                <div>שומן: {formatMacro(log.totalFat, ' גרם')}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => startEditing(log)} style={secondaryButtonStyle}>
                  ערוך יום
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDay(log)}
                  disabled={isDeletingDate === log.date}
                  style={dangerButtonStyle(isDeletingDate === log.date)}
                >
                  {isDeletingDate === log.date ? 'מוחק...' : 'מחק יום'}
                </button>
              </div>

              {isExpanded ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {log.items.map((item, index) => (
                    <div
                      key={`${log.date}-${item.originalText}-${index}`}
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: 16,
                        padding: 14,
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.displayName || item.originalText}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{item.originalText}</div>
                      {item.status === 'calculated' ? (
                        <div style={{ display: 'grid', gap: 4, fontSize: 15 }}>
                          <div>קלוריות: {formatMacro(item.calories)}</div>
                          <div>חלבון: {formatMacro(item.proteinGrams, ' גרם')}</div>
                          <div>פחמימות: {formatMacro(item.carbs, ' גרם')}</div>
                          <div>שומן: {formatMacro(item.fat, ' גרם')}</div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--danger)', fontSize: 14 }}>
                          לא פתור{item.reason ? `: ${item.reason}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        <Link href="/nutrition" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          חזרה למסך התזונה
        </Link>
      </div>
    </ProtectedPage>
  );
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  border: 0,
  borderRadius: 16,
  background: 'var(--accent)',
  color: '#fff',
  padding: '14px 16px',
  fontWeight: 800,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const secondaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 16,
  background: 'var(--surface-2)',
  color: '#fff',
  padding: '14px 16px',
  fontWeight: 800,
  cursor: 'pointer',
};

const dangerButtonStyle = (disabled: boolean): React.CSSProperties => ({
  border: 0,
  borderRadius: 16,
  background: 'var(--danger-bg)',
  color: 'var(--danger)',
  padding: '14px 16px',
  fontWeight: 800,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});
