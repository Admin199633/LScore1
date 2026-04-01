'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Heebo } from 'next/font/google';
import { ProtectedPage } from '@/components/ProtectedPage';
import { BodyweightChart } from '@/components/BodyweightChart';
import { useHomeData } from '@/lib/homeData';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
});

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export default function HomeV2Page() {
  const { bodyweightLogs, saveBodyweight } = useHomeData();
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [weightInput, setWeightInput] = useState('');
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  const recentLogs = useMemo(() => bodyweightLogs.slice(-8), [bodyweightLogs]);
  const lastEntry = bodyweightLogs.length ? bodyweightLogs[bodyweightLogs.length - 1] : null;
  const todayProtein = lastEntry?.proteinGrams ?? '--';
  const todayCalories = (lastEntry as any)?.calories ?? '--';

  const handleSaveBodyweight = async () => {
    const numericWeight = Number(String(weightInput).replace(',', '.'));
    if (!numericWeight || Number.isNaN(numericWeight) || numericWeight <= 0) return;

    setIsSavingWeight(true);
    try {
      await saveBodyweight(selectedDate, numericWeight);
      setWeightInput('');
    } finally {
      setIsSavingWeight(false);
    }
  };

  return (
    <ProtectedPage>
      <div className={`${heebo.className} wrap`}>
        <section className="hero">
          <div className="title">
            <h1>שדרוג יומי לביצועים</h1>
            <p>תמונת מצב יומית, רישום מהיר וגישה ישירה לתזונה ואימון.</p>
          </div>

          <div className="weight-card">
            <div className="weight-card-top">
              <div className="weight-card-label">רישום משקל</div>
              <div className="weight-card-meta">
                {lastEntry ? `${lastEntry.weight.toFixed(1)} ק"ג` : 'ללא רישום קודם'}
              </div>
            </div>

            <div className="weight-form-grid">
              <div className="weight-fields-row">
                <label className="field-shell field-shell-weight">
                  <span className="field-label">משקל</span>
                  <input
                    className="weight-input"
                    type="text"
                    inputMode="decimal"
                    placeholder={lastEntry ? `${lastEntry.weight.toFixed(1)}` : '66.8'}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                  />
                </label>

                <label className="field-shell field-shell-date">
                  <span className="field-label">תאריך</span>
                  <input
                    className="date-input"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </label>
              </div>

              <button className="save-btn" onClick={handleSaveBodyweight} disabled={isSavingWeight}>
                {isSavingWeight ? 'שומר...' : 'שמור שקילה'}
              </button>
            </div>
          </div>

          <div className="actions">
            <Link href="/nutrition" className="action-btn">
              תזונה
            </Link>
            <Link href="/workout" className="action-btn">
              אימון
            </Link>
          </div>

          <div className="stats">
            <div className="stat">
              <span>משקל</span>
              <strong>{lastEntry ? `${lastEntry.weight.toFixed(1)} ק"ג` : '--'}</strong>
            </div>
            <div className="stat">
              <span>חלבון</span>
              <strong>{todayProtein}</strong>
            </div>
            <div className="stat">
              <span>קלוריות</span>
              <strong>{todayCalories}</strong>
            </div>
          </div>
        </section>

        <section className="chart">
          <BodyweightChart logs={recentLogs} />
        </section>
      </div>

      <style jsx>{`
        .wrap {
          direction: rtl;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-height: 100vh;
          background: linear-gradient(120deg, #17394a 0%, #0c2343 62%, #081a3c 100%);
        }

        .hero {
          display: grid;
          gap: 18px;
          border-radius: 32px;
          padding: 24px 18px 18px;
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(6px);
          color: #fff;
          overflow: hidden;
        }

        .title {
          display: grid;
          gap: 8px;
        }

        .title h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
        }

        .title p {
          margin: 0;
          max-width: 32ch;
          font-size: 14px;
          font-weight: 500;
          color: rgba(231, 238, 247, 0.82);
          line-height: 1.5;
        }

        .weight-card {
          display: grid;
          gap: 14px;
          padding: 16px;
          border-radius: 22px;
          background: linear-gradient(135deg, rgba(90, 107, 121, 0.38), rgba(54, 71, 96, 0.32));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .weight-card-top {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          width: 100%;
        }

        .weight-card-label,
        .weight-card-meta {
          width: 100%;
          text-align: right;
        }

        .weight-card-label {
          font-size: 14px;
          font-weight: 700;
          color: rgba(243, 246, 251, 0.94);
        }

        .weight-card-meta {
          font-size: 13px;
          font-weight: 500;
          color: rgba(219, 228, 239, 0.72);
        }

        .weight-form-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .weight-fields-row {
          display: flex;
          align-items: end;
          gap: 10px;
        }

        .field-shell {
          display: grid;
          gap: 6px;
          justify-items: stretch;
        }

        .field-shell-weight {
          flex: 0 0 90px;
          align-items: stretch;
        }

        .field-shell-date {
          flex: 1;
          align-items: stretch;
        }

        .field-label {
          display: block;
          width: 100%;
          text-align: right;
          font-size: 12px;
          font-weight: 700;
          color: rgba(226, 234, 244, 0.72);
        }

        .weight-input {
          width: 100%;
          min-width: 0;
          height: 50px;
          padding: 0 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.07);
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          text-align: right;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .weight-input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }

        .date-input {
          width: 100%;
          min-width: 0;
          height: 48px;
          padding: 0 12px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.07);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .save-btn {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          align-items: center;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-width: 0;
          height: 50px;
          padding: 0 16px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 16px;
          text-decoration: none;
          letter-spacing: -0.01em;
          border: none;
          background: rgba(9, 21, 44, 0.25);
          color: #ffffff;
border: 2px solid rgba(255, 255, 255, 0.9);
box-shadow: none;
          backdrop-filter: blur(4px);
          transition: background 0.2s ease, box-shadow 0.2s ease;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.9);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .stat {
          min-height: 0;
          padding: 10px 10px 11px;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .stat span {
          font-size: 10px;
          font-weight: 500;
          opacity: 0.68;
          margin-bottom: 5px;
        }

        .stat strong {
          font-size: 15px;
          line-height: 1.15;
          font-weight: 800;
        }

        .chart {
          border-radius: 20px;
          padding: 10px;
          background: #0b1220;
        }

        @media (max-width: 640px) {
          .title h1 {
            font-size: 26px;
          }
        }

        @media (min-width: 768px) {
          .hero {
            gap: 22px;
            padding: 28px 24px 22px;
          }

          .title h1 {
            font-size: 31px;
          }

          .title p {
            font-size: 15px;
          }

          .weight-card {
            padding: 18px 18px 16px;
          }

          .field-shell-weight .weight-input {
            width: 80px;
            min-width: 80px;
            font-size: 20px;
          }

          .field-shell-date .date-input {
            min-width: 150px;
          }

          .actions {
            display: flex;
            gap: 14px;
          }

          .action-btn {
            width: auto;
            min-width: 108px;
            height: 54px;
            padding: 0 24px;
            font-size: 18px;
          }

          .stat {
            min-height: 68px;
            padding: 10px 12px;
          }

          .stat span {
            font-size: 11px;
            margin-bottom: 4px;
          }

          .stat strong {
            font-size: 16px;
          }
        }
      `}</style>
    </ProtectedPage>
  );
}
