'use client';

import Link from 'next/link';
import { type CSSProperties, FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  calculateNutritionFromText,
  parseProteinText,
  type NutritionCalculationResult,
} from '@shared-engines/proteinEngine';
import { type ProteinFoodEntry } from '@shared-engines/proteinFoods';
import { ProtectedPage } from '@/components/ProtectedPage';
import { appendNutritionLog, saveNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import { createUserFood, listUserFoods, type UserFoodRow } from '@/lib/repositories/userFoodRepository';
import {
  buildNutritionSearchEntries,
  buildNutritionSearchFoods,
  searchNutritionFoods,
  type NutritionSearchFood,
} from '@/lib/nutritionFoodLookup';
import { parseRecoveryParam } from '@/lib/recoveryContext';
import { RecoveryBanner } from '@/components/RecoveryBanner';

const EXAMPLE_INPUT = [''].join('\n');
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const formatMacro = (value?: number | null, suffix = '') =>
  value == null ? '-' : `${value.toFixed(1)}${suffix}`;
const AUTOCOMPLETE_DEBOUNCE_MS = 275;
const AUTOCOMPLETE_MIN_QUERY_LENGTH = 2;

const getCurrentLineRange = (value: string, caretPosition: number) => {
  const safeCaret = Math.max(0, Math.min(caretPosition, value.length));
  const lineStart = value.lastIndexOf('\n', safeCaret - 1) + 1;
  const nextNewlineIndex = value.indexOf('\n', safeCaret);
  const lineEnd = nextNewlineIndex === -1 ? value.length : nextNewlineIndex;

  return {
    start: lineStart,
    end: lineEnd,
    text: value.slice(lineStart, lineEnd),
  };
};

const getSearchQueryFromLine = (line: string) => {
  const parsed = parseProteinText(line)[0];
  return String(parsed?.cleanedFoodText || line || '').trim();
};

const replaceLineFoodText = (line: string, selectedFoodName: string) => {
  const parsed = parseProteinText(line)[0];
  if (!parsed) {
    return selectedFoodName;
  }

  const normalizedLine = parsed.originalText || String(line || '').trim();
  if (!parsed.cleanedFoodText) {
    return selectedFoodName;
  }

  return normalizedLine.replace(parsed.cleanedFoodText, selectedFoodName).trim();
};

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
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const skipNextAutocompleteRef = useRef(false);
  const [input, setInput] = useState(EXAMPLE_INPUT);
  const [caretPosition, setCaretPosition] = useState(0);
  const [debouncedAutocompleteQuery, setDebouncedAutocompleteQuery] = useState('');
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [results, setResults] = useState<NutritionCalculationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [personalFoods, setPersonalFoods] = useState<UserFoodRow[]>([]);

  type AddFoodModal = {
    sourceText: string;
    name: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    error: string;
    saving: boolean;
  };
  const [addFoodModal, setAddFoodModal] = useState<AddFoodModal | null>(null);

  const unresolvedItems = useMemo(
    () => results?.items.filter((item) => item.status === 'unresolved') ?? [],
    [results]
  );
  const unresolvedPreview = useMemo(() => unresolvedItems.slice(0, 2), [unresolvedItems]);
  const resultStatus = useMemo(() => (results ? getResultStatus(results) : null), [results]);
  const activeLine = useMemo(() => getCurrentLineRange(input, caretPosition), [input, caretPosition]);
  const autocompleteQuery = useMemo(() => getSearchQueryFromLine(activeLine.text), [activeLine.text]);
  const searchFoods = useMemo(() => buildNutritionSearchFoods(personalFoods), [personalFoods]);
  const autocompleteSuggestions = useMemo<NutritionSearchFood[]>(
    () => searchNutritionFoods(searchFoods, debouncedAutocompleteQuery, 8),
    [searchFoods, debouncedAutocompleteQuery]
  );
  const showAutocomplete =
    debouncedAutocompleteQuery.length >= AUTOCOMPLETE_MIN_QUERY_LENGTH &&
    autocompleteSuggestions.length > 0;

  useEffect(() => {
    if (recoveryType === 'nutrition' && !recoveryDismissed) {
      textareaRef.current?.focus();
    }
  }, [recoveryType, recoveryDismissed]);

  useEffect(() => {
    listUserFoods()
      .then((rows) => setPersonalFoods(rows))
      .catch(() => {}); // silent fail — falls back to JSON foods only
  }, []);

  useEffect(() => {
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextQuery =
        autocompleteQuery.length >= AUTOCOMPLETE_MIN_QUERY_LENGTH ? autocompleteQuery : '';
      setDebouncedAutocompleteQuery(nextQuery);
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [autocompleteQuery]);

  useEffect(() => {
    setHighlightedSuggestionIndex(autocompleteSuggestions.length > 0 ? 0 : -1);
  }, [autocompleteSuggestions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!autocompleteRef.current?.contains(event.target as Node)) {
        setDebouncedAutocompleteQuery('');
        setHighlightedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const mergedFoods = useMemo<ProteinFoodEntry[]>(
    () => buildNutritionSearchEntries(personalFoods),
    [personalFoods]
  );

  const updateCaretPosition = () => {
    setCaretPosition(textareaRef.current?.selectionStart ?? 0);
  };

  const closeAutocomplete = () => {
    setDebouncedAutocompleteQuery('');
    setHighlightedSuggestionIndex(-1);
  };

  const applyAutocompleteSuggestion = (suggestion: NutritionSearchFood) => {
    const nextLine = replaceLineFoodText(activeLine.text, suggestion.entry.name);
    const nextInput = `${input.slice(0, activeLine.start)}${nextLine}${input.slice(activeLine.end)}`;
    const nextCaretPosition = activeLine.start + nextLine.length;

    skipNextAutocompleteRef.current = true;
    setInput(nextInput);
    setCaretPosition(nextCaretPosition);
    closeAutocomplete();

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) {
      if (event.key === 'Escape') {
        closeAutocomplete();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedSuggestionIndex((current) =>
        current >= autocompleteSuggestions.length - 1 ? 0 : current + 1
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedSuggestionIndex((current) =>
        current <= 0 ? autocompleteSuggestions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === 'Enter') {
      const selectedSuggestion = autocompleteSuggestions[highlightedSuggestionIndex];
      if (selectedSuggestion) {
        event.preventDefault();
        applyAutocompleteSuggestion(selectedSuggestion);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeAutocomplete();
    }
  };

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

  const handleAddFoodSave = async () => {
    if (!addFoodModal) return;

    const name = addFoodModal.name.trim();
    const calories = Number(addFoodModal.calories);
    const protein = Number(addFoodModal.protein);
    const carbs = Number(addFoodModal.carbs);
    const fat = Number(addFoodModal.fat);

    if (!name) {
      setAddFoodModal((m) => m ? { ...m, error: 'שם המזון הוא שדה חובה.' } : null);
      return;
    }
    if (addFoodModal.calories === '' || isNaN(calories) || calories < 0) {
      setAddFoodModal((m) => m ? { ...m, error: 'יש להזין ערך קלוריות תקין.' } : null);
      return;
    }
    if (addFoodModal.protein === '' || isNaN(protein) || protein < 0) {
      setAddFoodModal((m) => m ? { ...m, error: 'יש להזין ערך חלבון תקין.' } : null);
      return;
    }
    if (addFoodModal.carbs === '' || isNaN(carbs) || carbs < 0) {
      setAddFoodModal((m) => m ? { ...m, error: 'יש להזין ערך פחמימות תקין.' } : null);
      return;
    }
    if (addFoodModal.fat === '' || isNaN(fat) || fat < 0) {
      setAddFoodModal((m) => m ? { ...m, error: 'יש להזין ערך שומן תקין.' } : null);
      return;
    }

    setAddFoodModal((m) => m ? { ...m, saving: true, error: '' } : null);

    try {
      const created = await createUserFood({
        name,
        aliases: [],
        calories,
        protein,
        carbs,
        fat,
        unit_type: 'weight',
        unit_label: '100g',
        unit_grams: 100,
        source_unresolved_text: addFoodModal.sourceText || null,
      });

      const nextPersonalFoods = [created, ...personalFoods];
      setPersonalFoods(nextPersonalFoods);

      // Re-run calculation immediately with the updated food list
      const nextMerged = buildNutritionSearchEntries(nextPersonalFoods);
      setResults(calculateNutritionFromText(input, nextMerged));

      setAddFoodModal(null);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || 'שמירת המזון נכשלה.';
      setAddFoodModal((m) => m ? { ...m, saving: false, error: msg } : null);
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

          {/* ׳˜׳§׳¡׳˜׳׳¨׳™׳” */}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
            <div ref={autocompleteRef} style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                id="nutrition-input"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setCaretPosition(event.target.selectionStart ?? event.target.value.length);
                }}
                onClick={updateCaretPosition}
                onKeyUp={updateCaretPosition}
                onSelect={updateCaretPosition}
                onKeyDown={handleTextareaKeyDown}
                placeholder={'׳׳“׳•׳’׳׳”:\n׳¡׳׳׳•׳ 100 ׳’׳¨׳\n2 ׳‘׳™׳¦׳™׳\n׳˜׳•׳ ׳”'}
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
              {showAutocomplete ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    insetInlineStart: 0,
                    insetInlineEnd: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                    overflow: 'hidden',
                    zIndex: 20,
                  }}
                >
                  {autocompleteSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.source}-${suggestion.normalizedName}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyAutocompleteSuggestion(suggestion)}
                      style={{
                        width: '100%',
                        border: 0,
                        borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                        background:
                          index === highlightedSuggestionIndex
                            ? 'var(--surface-2)'
                            : 'var(--surface)',
                        color: 'var(--text)',
                        padding: '10px 12px',
                        textAlign: 'right',
                        cursor: 'pointer',
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{suggestion.entry.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {suggestion.source === 'personal' ? 'אישי' : 'גלובלי'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {formatMacro(suggestion.calories)} קלוריות | {formatMacro(suggestion.protein)}g חלבון
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
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
                    <div
                      key={index}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--danger)', flex: 1 }}>
                        • {item.originalText}{item.reason ? ` — ${item.reason}` : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAddFoodModal({
                            sourceText: item.originalText,
                            name: item.name || item.originalText,
                            calories: '',
                            protein: '',
                            carbs: '',
                            fat: '',
                            error: '',
                            saving: false,
                          })
                        }
                        style={addFoodButtonStyle}
                      >
                        הוסף מזון
                      </button>
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

      {/* ── Add Custom Food Modal ─────────────────────────────────────────── */}
      {addFoodModal !== null ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !addFoodModal.saving) setAddFoodModal(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              padding: 24,
              width: '100%',
              maxWidth: 480,
              display: 'grid',
              gap: 14,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>הוספת מזון מותאם אישית</div>
              <button
                type="button"
                onClick={() => { if (!addFoodModal.saving) setAddFoodModal(null); }}
                style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Source text hint */}
            <div style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px' }}>
              מזון לא זוהה: &ldquo;{addFoodModal.sourceText}&rdquo;
            </div>

            {/* Name */}
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>שם המזון *</label>
              <input
                type="text"
                value={addFoodModal.name}
                onChange={(e) => setAddFoodModal((m) => m ? { ...m, name: e.target.value } : null)}
                placeholder="שם המזון"
                disabled={addFoodModal.saving}
                style={modalInputStyle}
              />
            </div>

            {/* Macro fields per 100g */}
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ערכים תזונתיים ל-100 גרם:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>קלוריות *</label>
                <input
                  type="number"
                  value={addFoodModal.calories}
                  onChange={(e) => setAddFoodModal((m) => m ? { ...m, calories: e.target.value } : null)}
                  placeholder="0"
                  min="0"
                  disabled={addFoodModal.saving}
                  style={modalInputStyle}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>חלבון (g) *</label>
                <input
                  type="number"
                  value={addFoodModal.protein}
                  onChange={(e) => setAddFoodModal((m) => m ? { ...m, protein: e.target.value } : null)}
                  placeholder="0"
                  min="0"
                  disabled={addFoodModal.saving}
                  style={modalInputStyle}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>פחמימות (g) *</label>
                <input
                  type="number"
                  value={addFoodModal.carbs}
                  onChange={(e) => setAddFoodModal((m) => m ? { ...m, carbs: e.target.value } : null)}
                  placeholder="0"
                  min="0"
                  disabled={addFoodModal.saving}
                  style={modalInputStyle}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>שומן (g) *</label>
                <input
                  type="number"
                  value={addFoodModal.fat}
                  onChange={(e) => setAddFoodModal((m) => m ? { ...m, fat: e.target.value } : null)}
                  placeholder="0"
                  min="0"
                  disabled={addFoodModal.saving}
                  style={modalInputStyle}
                />
              </div>
            </div>

            {addFoodModal.error ? (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>{addFoodModal.error}</div>
            ) : null}

            <button
              type="button"
              onClick={handleAddFoodSave}
              disabled={addFoodModal.saving}
              style={{
                border: 0,
                borderRadius: 14,
                background: 'var(--accent)',
                color: '#fff',
                padding: '14px 16px',
                fontWeight: 800,
                cursor: addFoodModal.saving ? 'default' : 'pointer',
                opacity: addFoodModal.saving ? 0.7 : 1,
                fontSize: 15,
              }}
            >
              {addFoodModal.saving ? 'שומר...' : 'שמור מזון'}
            </button>
          </div>
        </div>
      ) : null}
    </ProtectedPage>
  );
}

const modalInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 15,
};

const addFoodButtonStyle: CSSProperties = {
  border: '1px solid var(--danger)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--danger)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '3px 8px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export default function NutritionPage() {
  return (
    <Suspense fallback={null}>
      <NutritionPageContent />
    </Suspense>
  );
}
