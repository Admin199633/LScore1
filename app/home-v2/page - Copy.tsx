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
            </div>

		<div className="weight-entry-row">
  <input
    className="weight-input"
    type="text"
    inputMode="decimal"
    placeholder={lastEntry ? `${lastEntry.weight.toFixed(1)}` : '66.8'}
    value={weightInput}
    onChange={(e) => setWeightInput(e.target.value)}
  />

  <input
    className="date-input"
    type="date"
    value={selectedDate}
    onChange={(e) => setSelectedDate(e.target.value)}
  />

  <button className="save-btn" onClick={handleSaveBodyweight} disabled={isSavingWeight}>
    {isSavingWeight ? 'שומר...' : 'שמור'}
  </button>
</div>
          </div>

          <div className="actions">
            <Link href="/nutrition" className="action-btn nutrition">תזונה</Link>
            <Link href="/workout" className="action-btn workout">אימון</Link>
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
        }

        .hero {
          border-radius: 32px;
          padding: 28px 24px 22px;
          background: linear-gradient(120deg, #17394a 0%, #0c2343 62%, #081a3c 100%);
          color: #fff;
          overflow: hidden;
          min-height: 320px;
        }

        .title {
          margin-bottom: 24px;
        }

        .title h1 {
          margin: 0 0 10px;
          font-size: 31px;
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -0.03em;
        }

        .title p {
          margin: 0;
          font-size: 15px;
          font-weight: 500;
          color: rgba(231, 238, 247, 0.82);
          line-height: 1.55;
        }

        .weight-card {
          display: grid;
          gap: 14px;
          min-height: 114px;
          padding: 18px 18px 16px;
          margin-bottom: 22px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(90, 107, 121, 0.38), rgba(54, 71, 96, 0.32));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .weight-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .weight-card-date {
          font-size: 14px;
          font-weight: 500;
          color: rgba(219, 228, 239, 0.82);
          white-space: nowrap;
        }

        .weight-card-label {
          font-size: 15px;
          font-weight: 700;
          color: rgba(243, 246, 251, 0.94);
        }

        .weight-entry-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

			.weight-input {
			  flex: 0 0 90px;
			  width: 70px;
			  height: 40px;
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

        .save-btn {
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.07);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

.date-input {
  width: 140px;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

        .save-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .actions {
          display: flex;
          gap: 14px;
          margin-bottom: 22px;
          align-items: center;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 108px;
          height: 54px;
          padding: 0 24px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 18px;
          text-decoration: none;
          letter-spacing: -0.01em;
          border: 1.5px solid rgba(255, 255, 255, 0.9);
        }

        .action-btn.nutrition {
          background: #f2f2f3;
          color: #0b173b;
        }

        .action-btn.workout {
          background: rgba(9, 21, 44, 0.18);
          color: #ffffff;
        }

        .stats {
          display: flex;
          gap: 10px;
        }

        .stat {
          flex: 1;
          min-height: 68px;
          padding: 10px 12px;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
        }

        .stat span {
          font-size: 11px;
          font-weight: 500;
          opacity: 0.68;
          margin-bottom: 4px;
        }

        .stat strong {
          font-size: 16px;
          line-height: 1.1;
          font-weight: 800;
        }

        .chart {
          border-radius: 20px;
          padding: 10px;
          background: #0b1220;
        }

        @media (max-width: 640px) {
          .hero {
            padding: 24px 18px 20px;
          }

          .title {
            margin-bottom: 22px;
          }

          .title h1 {
            font-size: 28px;
          }

          .weight-card {
            margin-bottom: 20px;
          }

          .weight-input {
            flex-basis: 128px;
            width: 128px;
            font-size: 23px;
          }

          .actions {
            gap: 12px;
            margin-bottom: 20px;
          }

          .action-btn {
            min-width: 96px;
            height: 50px;
            padding: 0 20px;
            font-size: 17px;
          }
        }
      `}</style>
    </ProtectedPage>
  );
}
