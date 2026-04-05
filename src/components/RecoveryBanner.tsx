'use client';

type Props = {
  message: string;
};

export function RecoveryBanner({ message }: Props) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--text-muted)',
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 15 }}>💡</span>
      <span>{message}</span>
    </div>
  );
}
