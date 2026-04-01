export function PageSpinner() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        zIndex: 200,
      }}
    >
      <FuturisticSpinner />
    </div>
  );
}

export function FuturisticSpinner() {
  return (
    <div style={{ position: 'relative', width: 72, height: 72 }}>
      {/* Glow backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,184,153,0.15) 0%, transparent 70%)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
      {/* Outer ring — accent */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2.5px solid transparent',
          borderTopColor: '#0db899',
          borderRightColor: '#0db899',
          boxShadow: '0 0 14px rgba(13,184,153,0.5)',
          animation: 'spin 1.1s cubic-bezier(0.4,0,0.2,1) infinite',
        }}
      />
      {/* Middle ring — accent-2, reverse */}
      <div
        style={{
          position: 'absolute',
          inset: 10,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#b8a8ff',
          borderLeftColor: '#b8a8ff',
          boxShadow: '0 0 10px rgba(184,168,255,0.4)',
          animation: 'spin 0.8s linear infinite reverse',
        }}
      />
      {/* Inner dot */}
      <div
        style={{
          position: 'absolute',
          inset: 24,
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 12px rgba(13,184,153,0.8)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  );
}
