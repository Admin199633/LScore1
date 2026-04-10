import type { BodyMeasurementLog } from '@/lib/repositories/bodyMeasurementRepository';
import { inputStyle } from '../constants/profileStyles';

type MeasurementForm = {
  measurementDate: string;
  chestCm: string;
  waistCm: string;
  abdomenCm: string;
  hipsCm: string;
  leftArmCm: string;
  rightArmCm: string;
  leftThighCm: string;
  rightThighCm: string;
  neckCm: string;
  notes: string;
};

type MeasurementsSectionProps = {
  editingMeasurementId: string | null;
  measurementForm: MeasurementForm;
  updateMeasurementField: (field: keyof MeasurementForm, value: string) => void;
  handleSaveMeasurement: () => void;
  isSavingMeasurement: boolean;
  measurementMessage: string;
  measurementError: string;
  latestMeasurement: BodyMeasurementLog | null;
  measurementLogs: BodyMeasurementLog[];
  formatMeasurementValue: (value: number | null) => string;
  getFilledMeasurementValues: (measurement: BodyMeasurementLog) => string[];
  handleEditMeasurement: (measurement: BodyMeasurementLog) => void;
  handleDeleteMeasurement: (id: string) => void;
};

export function MeasurementsSection({
  editingMeasurementId,
  measurementForm,
  updateMeasurementField,
  handleSaveMeasurement,
  isSavingMeasurement,
  measurementMessage,
  measurementError,
  latestMeasurement,
  measurementLogs,
  formatMeasurementValue,
  getFilledMeasurementValues,
  handleEditMeasurement,
  handleDeleteMeasurement,
}: MeasurementsSectionProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 20,
        padding: 20,
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>מדידות היקפים</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          שמור היסטוריית מדידות גוף מסודרת במקום לנהל אותה בנפרד.
        </div>
        {editingMeasurementId ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            מצב עריכה פעיל עבור מדידה קיימת.
          </div>
        ) : null}
      </div>

      <input
        type="date"
        value={measurementForm.measurementDate}
        onChange={(event) => updateMeasurementField('measurementDate', event.target.value)}
        style={inputStyle}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input type="number" inputMode="decimal" step="0.1" placeholder="חזה (קו פטמות)" value={measurementForm.chestCm} onChange={(event) => updateMeasurementField('chestCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="מותן (האזור הצר ביותר)" value={measurementForm.waistCm} onChange={(event) => updateMeasurementField('waistCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="בטן (קו פופיק)" value={measurementForm.abdomenCm} onChange={(event) => updateMeasurementField('abdomenCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="אגן (החלק הרחב ביותר)" value={measurementForm.hipsCm} onChange={(event) => updateMeasurementField('hipsCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="יד שמאל (רפויה כלפי מטה)" value={measurementForm.leftArmCm} onChange={(event) => updateMeasurementField('leftArmCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="יד ימין (רפויה כלפי מטה)" value={measurementForm.rightArmCm} onChange={(event) => updateMeasurementField('rightArmCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="ירך שמאל (האמצע)" value={measurementForm.leftThighCm} onChange={(event) => updateMeasurementField('leftThighCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="ירך ימין (האמצע)" value={measurementForm.rightThighCm} onChange={(event) => updateMeasurementField('rightThighCm', event.target.value)} style={inputStyle} />
        <input type="number" inputMode="decimal" step="0.1" placeholder="צוואר (מתחת לגרוגרת)" value={measurementForm.neckCm} onChange={(event) => updateMeasurementField('neckCm', event.target.value)} style={inputStyle} />
      </div>

      <textarea
        placeholder="הערות"
        value={measurementForm.notes}
        onChange={(event) => updateMeasurementField('notes', event.target.value)}
        rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />

      <button
        type="button"
        onClick={handleSaveMeasurement}
        disabled={isSavingMeasurement}
        style={{
          border: 0,
          borderRadius: 18,
          background: 'var(--accent)',
          color: '#fff',
          padding: '16px 18px',
          fontWeight: 800,
          cursor: isSavingMeasurement ? 'default' : 'pointer',
          opacity: isSavingMeasurement ? 0.7 : 1,
        }}
      >
        {isSavingMeasurement ? 'שומר...' : 'שמור מדידה'}
      </button>

      {measurementMessage ? <div style={{ color: 'var(--success)', fontSize: 14 }}>{measurementMessage}</div> : null}
      {measurementError ? <div style={{ color: 'var(--danger)', fontSize: 14 }}>{measurementError}</div> : null}

      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 16,
          padding: 14,
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 700 }}>המדידה האחרונה</div>
        {latestMeasurement ? (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>תאריך: {latestMeasurement.measurementDate}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
              <div>חזה (קו פטמות): {formatMeasurementValue(latestMeasurement.chestCm)}</div>
              <div>מותן (האזור הצר ביותר): {formatMeasurementValue(latestMeasurement.waistCm)}</div>
              <div>בטן (קו פופיק): {formatMeasurementValue(latestMeasurement.abdomenCm)}</div>
              <div>אגן (החלק הרחב ביותר): {formatMeasurementValue(latestMeasurement.hipsCm)}</div>
              <div>יד שמאל (רפויה כלפי מטה): {formatMeasurementValue(latestMeasurement.leftArmCm)}</div>
              <div>יד ימין (רפויה כלפי מטה): {formatMeasurementValue(latestMeasurement.rightArmCm)}</div>
              <div>ירך שמאל (האמצע): {formatMeasurementValue(latestMeasurement.leftThighCm)}</div>
              <div>ירך ימין (האמצע): {formatMeasurementValue(latestMeasurement.rightThighCm)}</div>
              <div>צוואר (מתחת לגרוגרת): {formatMeasurementValue(latestMeasurement.neckCm)}</div>
            </div>
            {latestMeasurement.notes ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>הערות: {latestMeasurement.notes}</div>
            ) : null}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>עדיין לא נשמרו מדידות.</div>
        )}
      </div>

      {measurementLogs.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>היסטוריה</div>
          {measurementLogs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              style={{
                background: 'var(--surface-2)',
                borderRadius: 14,
                padding: '12px 14px',
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
                <div style={{ fontWeight: 700 }}>{log.measurementDate}</div>
                <button
                  type="button"
                  onClick={() => handleEditMeasurement(log)}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    padding: '8px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ערוך
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMeasurement(log.id)}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    padding: '8px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  מחק
                </button>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{getFilledMeasurementValues(log).join(' | ')}</div>
              {log.notes ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>הערות: {log.notes}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
