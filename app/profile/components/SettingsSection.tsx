import type { ThemePreference } from '@/lib/theme';
import type { VibrationInterval } from '@/lib/vibrationSettings';
import { chipStyle } from '../constants/profileStyles';

type SettingsSectionProps = {
  themeLabel: string;
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (value: boolean) => void;
  vibrationInterval: VibrationInterval;
  setVibrationInterval: (value: VibrationInterval) => void;
  vibrationOptions: readonly VibrationInterval[];
};

export function SettingsSection({
  themeLabel,
  themePreference,
  setThemePreference,
  vibrationEnabled,
  setVibrationEnabled,
  vibrationInterval,
  setVibrationInterval,
  vibrationOptions,
}: SettingsSectionProps) {
  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 20,
          padding: 20,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>ערכת נושא</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>נוכחי: {themeLabel}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setThemePreference('light')} style={chipStyle(themePreference === 'light')}>
            בהיר
          </button>
          <button type="button" onClick={() => setThemePreference('dark')} style={chipStyle(themePreference === 'dark')}>
            כהה
          </button>
          <button type="button" onClick={() => setThemePreference('ai')} style={chipStyle(themePreference === 'ai')}>
            AI
          </button>
        </div>
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
        <div style={{ fontSize: 18, fontWeight: 800 }}>תזכורות אימון</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>תזכורת רטט בזמן אימון</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              רטט קצר בכל מרווח זמן קבוע
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '10px 16px',
              background: vibrationEnabled ? 'var(--accent)' : 'var(--surface-2)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {vibrationEnabled ? 'פעיל' : 'כבוי'}
          </button>
        </div>
        {vibrationEnabled ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>מרווח בין תזכורות</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {vibrationOptions.map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => setVibrationInterval(seconds)}
                  style={chipStyle(vibrationInterval === seconds)}
                >
                  {seconds >= 60 ? `${seconds / 60} דקות` : `${seconds} שניות`}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
