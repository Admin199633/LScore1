import type { CSSProperties } from 'react';

export const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: 12,
};

export const chipStyle = (active: boolean): CSSProperties => ({
  border: 0,
  borderRadius: 999,
  padding: '10px 14px',
  background: active ? 'var(--accent)' : 'var(--surface-2)',
  color: '#fff',
  cursor: 'pointer',
});

export const secondaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--surface-2)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};

export const dangerButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: '12px 14px',
  background: 'var(--danger-bg)',
  color: 'var(--danger)',
  cursor: 'pointer',
  fontWeight: 700,
};

export const ghostButtonStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 0,
};
