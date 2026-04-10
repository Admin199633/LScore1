import type { NutritionTargetMode } from '@/lib/nutritionTargets';
import { EXPERIENCE_OPTIONS, GENDER_OPTIONS, GOAL_OPTIONS } from '../constants/profileOptions';
import { chipStyle, inputStyle } from '../constants/profileStyles';

type ProfileForm = {
  age: string;
  height: string;
  gender: string;
  experience: string;
  goal: string;
  focusAreasText: string;
  nutritionTargetMode: NutritionTargetMode;
  manualDailyCalories: string;
  manualDailyProtein: string;
};

type ProfileSectionProps = {
  email: string;
  form: ProfileForm;
  updateField: (field: keyof ProfileForm, value: string | NutritionTargetMode) => void;
  handleSave: () => void;
  isSaving: boolean;
};

export function ProfileSection({ email, form, updateField, handleSave, isSaving }: ProfileSectionProps) {
  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 20,
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>פרופיל</div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>הגדרות אישיות</div>
        <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          עדכון פרטים אישיים, נושא תצוגה, וגישה לפעולות החשבון.
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{email}</div>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 20,
          display: 'grid',
          gap: 12,
        }}
      >
        <input type="number" placeholder="גיל" value={form.age} onChange={(event) => updateField('age', event.target.value)} style={inputStyle} />
        <input type="number" placeholder="גובה" value={form.height} onChange={(event) => updateField('height', event.target.value)} style={inputStyle} />

        <div style={{ fontSize: 14, fontWeight: 700 }}>מגדר</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GENDER_OPTIONS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => updateField('gender', value)} style={chipStyle(form.gender === value)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700 }}>ניסיון</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXPERIENCE_OPTIONS.map(([value, label]) => {
            const isActive = form.experience === value;
            return (
              <button key={value} type="button" onClick={() => updateField('experience', value)} style={chipStyle(isActive)}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700 }}>מטרה</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_OPTIONS.map(([value, label]) => {
            const isActive = form.goal === value;
            return (
              <button key={value} type="button" onClick={() => updateField('goal', value)} style={chipStyle(isActive)}>
                {label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="אזורי מיקוד, מופרדים בפסיקים"
          value={form.focusAreasText}
          onChange={(event) => updateField('focusAreasText', event.target.value)}
          style={inputStyle}
        />

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>יעדי תזונה</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            אפשר להשתמש ביעדים המחושבים מהפרופיל או להגדיר יעדים יומיים ידניים.
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>מצב יעד</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => updateField('nutritionTargetMode', 'auto')} style={chipStyle(form.nutritionTargetMode === 'auto')}>
              אוטומטי
            </button>
            <button type="button" onClick={() => updateField('nutritionTargetMode', 'manual')} style={chipStyle(form.nutritionTargetMode === 'manual')}>
              ידני
            </button>
          </div>
          {form.nutritionTargetMode === 'manual' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="יעד קלוריות יומי"
                value={form.manualDailyCalories}
                onChange={(event) => updateField('manualDailyCalories', event.target.value)}
                style={inputStyle}
              />
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="יעד חלבון יומי"
                value={form.manualDailyProtein}
                onChange={(event) => updateField('manualDailyProtein', event.target.value)}
                style={inputStyle}
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            border: 0,
            borderRadius: 18,
            background: 'var(--accent)',
            color: '#fff',
            padding: '16px 18px',
            fontWeight: 800,
            cursor: isSaving ? 'default' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? 'שומר...' : 'שמור פרופיל'}
        </button>
      </div>
    </>
  );
}
