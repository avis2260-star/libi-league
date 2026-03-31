'use client';

import { useState, useTransition } from 'react';
import { approveSubmission, rejectSubmission, clearSubmission } from '@/app/admin/actions';

type ExtractedPlayer = {
  name: string;
  jersey: number | null;
  points: number;
  three_pointers: number;
  fouls: number;
};

type ExtractedStats = {
  home_score: number;
  away_score: number;
  home_players: ExtractedPlayer[];
  away_players: ExtractedPlayer[];
};

export type SubmissionRow = {
  id: string;
  game_id: string;
  submitted_by: string;
  confidence_score: number;
  quality_status: string;
  extracted_stats: ExtractedStats | null;
  home_score: number;
  away_score: number;
  status: 'pending' | 'needs_review' | 'approved' | 'rejected';
  review_notes: string | null;
  created_at: string;
  home_name: string;
  away_name: string;
  game_date: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:      { label: 'ממתין',    cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30'   },
  needs_review: { label: 'לבדיקה',  cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  approved:     { label: 'אושר',    cls: 'bg-green-500/15 text-green-300 border-green-500/30'  },
  rejected:     { label: 'נדחה',    cls: 'bg-red-500/15 text-red-300 border-red-500/30'        },
};

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 7 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-bold ${color}`}>{score}/10</span>;
}

function PlayerTable({ players, teamName }: { players: ExtractedPlayer[]; teamName: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-[#8aaac8] uppercase tracking-wide">{teamName}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[#4a6a8a] border-b border-white/5">
            <th className="text-right pb-1 font-medium">שם</th>
            <th className="text-center pb-1 font-medium w-8">#</th>
            <th className="text-center pb-1 font-medium w-10">נק׳</th>
            <th className="text-center pb-1 font-medium w-10">3נק׳</th>
            <th className="text-center pb-1 font-medium w-10">פאול</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {players.map((p, i) => (
            <tr key={i} className="text-gray-300">
              <td className="py-1 pr-1">{p.name}</td>
              <td className="py-1 text-center text-[#5a7a9a]">{p.jersey ?? '—'}</td>
              <td className="py-1 text-center">{p.points}</td>
              <td className="py-1 text-center">{p.three_pointers}</td>
              <td className="py-1 text-center">{p.fouls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionCard({ sub }: { sub: SubmissionRow }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const badge = STATUS_LABELS[sub.status] ?? STATUS_LABELS.pending;
  const dateLabel = new Date(sub.created_at).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  function act(fn: () => Promise<{ error?: string }>) {
    setError('');
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status badge */}
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
          {badge.label}
        </span>

        {/* Game + submitter */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {sub.home_name} <span className="text-[#4a6a8a]">נגד</span> {sub.away_name}
          </p>
          <p className="text-xs text-[#5a7a9a] truncate">
            {sub.game_date} · הוגש ע״י <span className="text-[#8aaac8]">{sub.submitted_by}</span> · {dateLabel}
          </p>
        </div>

        {/* Score */}
        <div className="shrink-0 text-sm font-black text-orange-400">
          {sub.home_score}:{sub.away_score}
        </div>

        {/* Confidence */}
        <div className="shrink-0 text-xs">
          <ConfidenceBadge score={sub.confidence_score} />
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-[#4a6a8a] hover:text-white transition-colors text-xs"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded: extracted stats + actions */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          {sub.quality_status === 'fail' && (
            <p className="text-xs text-yellow-300 bg-yellow-500/10 rounded-lg p-2">
              ⚠️ תמונה ירודה — ייתכן שהנתונים דורשים תיקון ידני
            </p>
          )}

          {/* Players */}
          {sub.extracted_stats && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PlayerTable players={sub.extracted_stats.home_players ?? []} teamName={sub.home_name} />
              <PlayerTable players={sub.extracted_stats.away_players ?? []} teamName={sub.away_name} />
            </div>
          )}

          {sub.review_notes && (
            <p className="text-xs text-[#8aaac8] bg-white/5 rounded-lg p-2">
              📝 הערות: {sub.review_notes}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {(sub.status === 'pending' || sub.status === 'needs_review') && (
              <>
                <button
                  onClick={() => act(() => approveSubmission(sub.id))}
                  disabled={isPending}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all"
                >
                  ✅ אשר ועדכן תוצאה
                </button>

                {showRejectInput ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="סיבת דחייה (אופציונלי)"
                      value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#4a6a8a] focus:outline-none focus:border-red-500/50"
                    />
                    <button
                      onClick={() => act(() => rejectSubmission(sub.id, rejectNotes))}
                      disabled={isPending}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all"
                    >
                      דחה
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="text-[#5a7a9a] hover:text-white text-xs px-2 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="flex-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold py-2 px-4 rounded-xl transition-all"
                  >
                    ✗ דחה
                  </button>
                )}
              </>
            )}

            {/* Clear always available */}
            <button
              onClick={() => {
                if (confirm('למחוק הגשה זו לגמרי? פעולה זו אינה הפיכה.')) {
                  act(() => clearSubmission(sub.id));
                }
              }}
              disabled={isPending}
              className="border border-white/10 text-[#5a7a9a] hover:text-white hover:border-white/20 text-xs font-medium py-2 px-4 rounded-xl transition-all disabled:opacity-40"
            >
              🗑 מחק הגשה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type Filter = 'all' | 'pending' | 'needs_review' | 'approved' | 'rejected';

export default function SubmissionsTab({ submissions }: { submissions: SubmissionRow[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const visible = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);

  const counts = {
    pending:      submissions.filter(s => s.status === 'pending').length,
    needs_review: submissions.filter(s => s.status === 'needs_review').length,
    approved:     submissions.filter(s => s.status === 'approved').length,
    rejected:     submissions.filter(s => s.status === 'rejected').length,
  };

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',          label: 'הכל',    count: submissions.length },
    { key: 'pending',      label: 'ממתין',  count: counts.pending },
    { key: 'needs_review', label: 'לבדיקה', count: counts.needs_review },
    { key: 'approved',     label: 'אושר',   count: counts.approved },
    { key: 'rejected',     label: 'נדחה',   count: counts.rejected },
  ];

  return (
    <div className="space-y-6 p-4" dir="rtl">
      <div>
        <h2 className="text-xl font-black text-white">הגשות תוצאות</h2>
        <p className="text-sm text-[#5a7a9a] mt-0.5">טפסים שהוגשו על ידי משתמשים לאישור</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all flex items-center gap-1.5 ${
              filter === t.key
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'border border-white/10 bg-white/5 text-[#8aaac8] hover:border-white/20 hover:text-white'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                filter === t.key ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] py-16 text-center">
          <p className="text-[#5a7a9a]">אין הגשות להצגה</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(sub => (
            <SubmissionCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}
