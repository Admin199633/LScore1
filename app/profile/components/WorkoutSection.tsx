import { RecoveryBanner } from '@/components/RecoveryBanner';
import {
  chipStyle,
  dangerButtonStyle,
  ghostButtonStyle,
  inputStyle,
  secondaryButtonStyle,
} from '../constants/profileStyles';

type ProgramRow = {
  id: string;
  exercise: string;
  sets: string;
  repsHeavy: string;
  weightHeavy: string;
};

type ProgramDay = {
  id: string;
  name: string;
  rows: ProgramRow[];
};

type WorkoutSectionProps = {
  programSummary: { dayCount: number; names: string[] };
  recoveryType: string | null;
  recoveryDismissed: boolean;
  programDays: ProgramDay[];
  selectedDayIndex: number;
  selectedProgramDay: ProgramDay;
  setSelectedDayIndex: (index: number) => void;
  addProgramDay: () => void;
  removeProgramDay: () => void;
  updateDayName: (value: string) => void;
  removeProgramRow: (rowIndex: number) => void;
  updateProgramRow: (
    rowIndex: number,
    field: 'exercise' | 'sets' | 'repsHeavy' | 'weightHeavy',
    value: string
  ) => void;
  addProgramRow: () => void;
  handleSaveProgram: () => void;
  isSavingProgram: boolean;
};

export function WorkoutSection({
  programSummary,
  recoveryType,
  recoveryDismissed,
  programDays,
  selectedDayIndex,
  selectedProgramDay,
  setSelectedDayIndex,
  addProgramDay,
  removeProgramDay,
  updateDayName,
  removeProgramRow,
  updateProgramRow,
  addProgramRow,
  handleSaveProgram,
  isSavingProgram,
}: WorkoutSectionProps) {
  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 20,
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>תוכנית נוכחית</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {programSummary.dayCount > 0
            ? `${programSummary.dayCount} ימי אימון: ${programSummary.names.join(', ')}`
            : 'עדיין אין תוכנית פעילה.'}
        </div>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 20,
          display: 'grid',
          gap: 14,
          ...(recoveryType === 'program' && !recoveryDismissed
            ? { outline: '2px solid var(--accent)', outlineOffset: 2 }
            : {}),
        }}
      >
        {recoveryType === 'program' && !recoveryDismissed ? (
          <RecoveryBanner message="כדאי להגדיר תוכנית אימונים פעילה כדי שנוכל לעקוב נכון אחרי ההתקדמות שלך." />
        ) : null}
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>עריכת תוכנית אימון</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            בחר יום, עדכן את שם היום ואת שורות התרגילים, ושמור את התוכנית.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {programDays.map((day, index) => {
            const isActive = index === selectedDayIndex;
            return (
              <button
                key={day.id || `program-day-${index}`}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                style={chipStyle(isActive)}
              >
                {day.name || `יום ${index + 1}`}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={addProgramDay} style={secondaryButtonStyle}>
            הוסף יום אימון
          </button>
          <button type="button" onClick={removeProgramDay} style={dangerButtonStyle}>
            מחק את היום הנבחר
          </button>
        </div>

        <input
          type="text"
          placeholder="שם היום"
          value={selectedProgramDay.name}
          onChange={(event) => updateDayName(event.target.value)}
          style={inputStyle}
        />

        <div style={{ display: 'grid', gap: 12 }}>
          {selectedProgramDay.rows.map((row, rowIndex) => (
            <div
              key={`${selectedDayIndex}-${rowIndex}`}
              style={{
                background: 'var(--surface-2)',
                borderRadius: 16,
                padding: 14,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => removeProgramRow(rowIndex)}
                  style={{ ...ghostButtonStyle, color: 'var(--danger)' }}
                >
                  מחק שורה
                </button>
                <div style={{ fontWeight: 700 }}>{`תרגיל ${rowIndex + 1}`}</div>
              </div>

              <input
                type="text"
                placeholder="תרגיל"
                value={row.exercise}
                onChange={(event) => updateProgramRow(rowIndex, 'exercise', event.target.value)}
                style={inputStyle}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input
                  type="text"
                  placeholder="סטים"
                  value={row.sets}
                  onChange={(event) => updateProgramRow(rowIndex, 'sets', event.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="חזרות"
                  value={row.repsHeavy}
                  onChange={(event) => updateProgramRow(rowIndex, 'repsHeavy', event.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="משקל"
                  value={row.weightHeavy}
                  onChange={(event) => updateProgramRow(rowIndex, 'weightHeavy', event.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addProgramRow} style={secondaryButtonStyle}>
          הוסף שורת תרגיל
        </button>

        <button
          type="button"
          onClick={handleSaveProgram}
          disabled={isSavingProgram}
          style={{
            border: 0,
            borderRadius: 18,
            background: 'var(--accent)',
            color: '#fff',
            padding: '16px 18px',
            fontWeight: 800,
            cursor: isSavingProgram ? 'default' : 'pointer',
            opacity: isSavingProgram ? 0.7 : 1,
          }}
        >
          {isSavingProgram ? 'שומר...' : 'שמור תוכנית'}
        </button>
      </div>
    </>
  );
}
