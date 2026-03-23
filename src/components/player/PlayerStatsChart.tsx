'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';

export interface ChartDataPoint {
  game: string;       // "G1", "G2", …
  opponent: string;
  points: number;
  threePt: number;
  fouls: number;
}

interface Props {
  data: ChartDataPoint[];
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const opponent = payload[0]?.payload?.opponent as string | undefined;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold text-gray-400">
        {label}{opponent ? ` · vs ${opponent}` : ''}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-300">{entry.name}</span>
          </span>
          <span className="font-bold text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────

export default function PlayerStatsChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Not enough games to draw a chart yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1f2937"
          vertical={false}
        />

        <XAxis
          dataKey="game"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={{ stroke: '#1f2937' }}
          tickLine={false}
        />

        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1 }} />

        <Legend
          wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9ca3af' }}
        />

        {/* Points — primary orange line */}
        <Line
          type="monotone"
          dataKey="points"
          name="Points"
          stroke="#f97316"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
        />

        {/* 3-Pointers — secondary sky line */}
        <Line
          type="monotone"
          dataKey="threePt"
          name="3-Pointers"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
        />

        {/* Fouls — muted rose line */}
        <Line
          type="monotone"
          dataKey="fouls"
          name="Fouls"
          stroke="#fb7185"
          strokeWidth={1.5}
          strokeDasharray="2 4"
          dot={{ r: 3, fill: '#fb7185', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#fb7185', stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
