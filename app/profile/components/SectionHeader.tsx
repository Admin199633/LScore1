type SectionHeaderProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function SectionHeader({ title, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        border: 0,
        borderRadius: 20,
        background: 'var(--surface)',
        color: 'var(--text)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'pointer',
        fontWeight: 800,
        fontSize: 18,
      }}
    >
      <span>{title}</span>
      <span>{isOpen ? 'ג–¼' : 'ג–¶'}</span>
    </button>
  );
}
