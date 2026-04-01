'use client';

import { FormEvent, useState } from 'react';
import { signInWithEmail, signUpWithEmail } from '@/lib/auth';

type Mode = 'sign-in' | 'sign-up';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    try {
      if (mode === 'sign-in') {
        await signInWithEmail({ email, password });
      } else {
        const result = await signUpWithEmail({ email, password });
        setMessageType('success');
        setMessage(result.session ? 'החשבון נוצר והתחברת בהצלחה.' : 'החשבון נוצר. ייתכן שצריך לאשר את האימייל.');
      }
    } catch (error) {
      setMessageType('error');
      setMessage(error instanceof Error ? error.message : 'הפעולה נכשלה. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 32px)',
        display: 'grid',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 24,
          padding: 20,
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>Gym Web</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{mode === 'sign-in' ? 'התחברות' : 'יצירת חשבון'}</div>
          <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
            התחברות עם אותו משתמש של האפליקציה הקיימת.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setMode('sign-up')}
            style={toggleButtonStyle(mode === 'sign-up')}
          >
            הרשמה
          </button>
          <button
            type="button"
            onClick={() => setMode('sign-in')}
            style={toggleButtonStyle(mode === 'sign-in')}
          >
            התחברות
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="אימייל"
            required
            style={inputStyle}
            dir="ltr"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="סיסמה"
            required
            style={inputStyle}
            dir="ltr"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              border: 0,
              borderRadius: 18,
              background: 'var(--accent)',
              color: '#fff',
              padding: '14px 16px',
              fontWeight: 800,
              cursor: 'pointer',
              opacity: isSubmitting ? 0.65 : 1,
            }}
          >
            {isSubmitting ? 'שולח...' : mode === 'sign-in' ? 'התחבר' : 'צור חשבון'}
          </button>
        </form>

        {message ? (
          <div
            style={{
              background: messageType === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
              color: messageType === 'error' ? 'var(--danger)' : 'var(--success)',
              borderRadius: 16,
              padding: '12px 14px',
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: '14px 16px',
  outline: 'none',
};

const toggleButtonStyle = (isActive: boolean): React.CSSProperties => ({
  border: 0,
  borderRadius: 16,
  padding: '12px 14px',
  background: isActive ? 'var(--accent)' : 'var(--surface-2)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
});
