'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText } from 'lucide-react';

interface ReportCard {
  quarterLabel: string;
  openingBalance: number;
  closingBalance: number;
  contributionsInPeriod: number;
  returnPercent: number;
  benchmarkReturnPercent: number | null;
  outperformancePercent: number | null;
  rebalanceCount: number;
  summary: string;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Quarterly report cards.
 *
 * Each quarter is a KPI row plus the generated narrative. Deliberately not a
 * chart: four headline numbers per quarter read faster as stat tiles than as
 * bars, and the narrative carries the part a chart cannot.
 */
export default function ReportCards() {
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/retirement-vault/performance?range=ALL');
        setCards(res.data?.reportCards ?? []);
      } catch {
        setCards([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (!loaded) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <FileText className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900">Quarterly report cards</h2>
      </div>

      {cards.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500">
            Your first report card is generated once your vault has been valued on at least
            two days in a quarter.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {cards.map((c) => {
            const ahead = (c.outperformancePercent ?? 0) >= 0;
            return (
              <div key={c.quarterLabel} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-900">{c.quarterLabel}</span>
                  <span
                    className={`text-sm font-bold ${
                      c.returnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {c.returnPercent >= 0 ? '+' : ''}
                    {c.returnPercent.toFixed(2)}%
                  </span>
                </div>

                {/* KPI row — headline numbers as stat tiles, not a chart. */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  {[
                    ['Opening', money(c.openingBalance)],
                    ['Closing', money(c.closingBalance)],
                    ['Contributed', money(c.contributionsInPeriod)],
                    [
                      'vs 401k',
                      c.outperformancePercent === null
                        ? '—'
                        : `${ahead ? '+' : ''}${c.outperformancePercent.toFixed(2)} pts`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded px-3 py-2">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p
                        className={`text-sm font-semibold ${
                          label === 'vs 401k' && c.outperformancePercent !== null
                            ? ahead
                              ? 'text-green-600'
                              : 'text-red-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">{c.summary}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
