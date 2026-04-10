import { ghostButtonStyle, inputStyle } from '../constants/profileStyles';

export type EditFoodModalState = {
  id: string;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  error: string;
  saving: boolean;
};

type EditFoodModalProps = {
  modal: EditFoodModalState;
  onClose: () => void;
  onSave: () => void;
  onChange: (patch: Partial<EditFoodModalState>) => void;
};

export function EditFoodModal({ modal, onClose, onSave, onChange }: EditFoodModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 100,
      }}
      onClick={() => !modal.saving && onClose()}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: 24,
          width: '100%',
          display: 'grid',
          gap: 12,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>עריכת מזון</div>
        <input
          type="text"
          placeholder="שם"
          value={modal.name}
          onChange={(event) => onChange({ name: event.target.value })}
          style={inputStyle}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input
            type="number"
            placeholder="קלוריות"
            value={modal.calories}
            onChange={(event) => onChange({ calories: event.target.value })}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="חלבון"
            value={modal.protein}
            onChange={(event) => onChange({ protein: event.target.value })}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="פחמימות"
            value={modal.carbs}
            onChange={(event) => onChange({ carbs: event.target.value })}
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="שומן"
            value={modal.fat}
            onChange={(event) => onChange({ fat: event.target.value })}
            style={inputStyle}
          />
        </div>
        {modal.error ? (
          <div style={{ color: 'var(--danger)', fontSize: 14 }}>{modal.error}</div>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={modal.saving}
          style={{
            border: 0,
            borderRadius: 18,
            background: 'var(--accent)',
            color: '#fff',
            padding: '16px 18px',
            fontWeight: 800,
            cursor: modal.saving ? 'default' : 'pointer',
            opacity: modal.saving ? 0.7 : 1,
          }}
        >
          {modal.saving ? 'שומר...' : 'שמור'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={modal.saving}
          style={{ ...ghostButtonStyle, textAlign: 'center', padding: '8px 0' }}
        >
          ׳ג€˜׳ג„¢׳ֻ׳ג€¢׳ֲ
        </button>
      </div>
    </div>
  );
}
