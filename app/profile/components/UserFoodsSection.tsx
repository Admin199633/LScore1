import type { UserFoodRow } from '@/lib/repositories/userFoodRepository';

type UserFoodsSectionProps = {
  userFoodsLoading: boolean;
  userFoodsError: string;
  userFoods: UserFoodRow[];
  onEdit: (food: UserFoodRow) => void;
  onDelete: (id: string) => void;
};

export function UserFoodsSection({
  userFoodsLoading,
  userFoodsError,
  userFoods,
  onEdit,
  onDelete,
}: UserFoodsSectionProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 20,
        padding: 20,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800 }}>׳”׳׳–׳•׳ ׳•׳× ׳©׳׳™</div>
      {userFoodsLoading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>׳˜׳•׳¢׳...</div>
      ) : userFoodsError ? (
        <div style={{ color: 'var(--danger)', fontSize: 14 }}>{userFoodsError}</div>
      ) : userFoods.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          ׳׳™׳ ׳׳–׳•׳ ׳•׳× ׳׳•׳×׳׳׳™׳ ׳׳™׳©׳™׳× ׳¢׳“׳™׳™׳.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {userFoods.map((food) => (
            <div
              key={food.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: 'var(--surface-2)',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontWeight: 700 }}>{food.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {food.calories} ׳§׳׳•׳¨׳™׳•׳× | {food.protein} ׳—׳׳‘׳•׳
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => onEdit(food)}
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
                  ׳¢׳¨׳•׳
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(food.id)}
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
                  ׳׳—׳§
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
