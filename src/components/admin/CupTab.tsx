'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveCupSetting } from '@/app/admin/actions';

type Team = { id: string; name: string };

export type CupGame = {
  id: string;
  round: string;
  round_order: number;
  game_number: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  date: string | null;
  played: boolean;
};

type Props = {
  teamIds: string[];   // selected participating-team UUIDs
  teams: Team[];       // all teams in the league
  games: CupGame[];    // existing cup_games rows
};

export default function CupTab({ teamIds: tInit, teams, games: gInit }: Props) {
  // ── Section A — participating teams ────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set(tInit));
  const [savingTeams, setSavingTeams] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function flash(text: string, ok: boolean) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 2500);
  }

  function toggleTeam(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveTeams() {
    setSavingTeams(true);
    startTransition(async () => {
      const result = await saveCupSetting('cup_tournament_teams', JSON.stringify([...selected]));
      setSavingTeams(false);
      if (result.error) flash(result.error, false);
      else flash('✓ רשימת קבוצות נשמרה', true);
    });
  }

  const teamsChanged = JSON.stringify([...selected].sort()) !== JSON.stringify([...tInit].sort());

  // ── Section B — bracket builder ────────────────────────────────────────
  const [games, setGames] = useState<CupGame[]>(gInit);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CupGame | null>(null);

  // Group games by round, preserving each round's earliest round_order.
  const rounds = useMemo(() => {
    const map = new Map<string, { round: string; round_order: number; games: CupGame[] }>();
    for (const g of [...games].sort((a, b) => a.round_order - b.round_order || a.game_number - b.game_number)) {
      const existing = map.get(g.round);
      if (existing) existing.games.push(g);
      else map.set(g.round, { round: g.round, round_order: g.round_order, games: [g] });
    }
    return [...map.values()].sort((a, b) => a.round_order - b.round_order);
  }, [games]);

  // Winners of the most recently-played round (best-effort sanity check for admin).
  const previousWinners = useMemo(() => {
    if (rounds.length < 2) return null;
    // Take the second-to-last group as "previous round"; show winners from it.
    const prev = rounds[rounds.length - 2];
    const winners = prev.games
      .filter(g => g.played && g.home_score != null && g.away_score != null)
      .map(g => (g.home_score! > g.away_score! ? g.home_team : g.away_team));
    if (!winners.length) return null;
    return { roundName: prev.round, winners };
  }, [rounds]);

  async function addGame(round: string, round_order: number, defaults?: Partial<CupGame>) {
    setBusyId('add');
    try {
      const game_number = (rounds.find(r => r.round === round)?.games.length ?? 0) + 1;
      const res = await fetch('/api/admin/cup-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round,
          round_order,
          game_number,
          home_team: defaults?.home_team ?? teams[0]?.name ?? '',
          away_team: defaults?.away_team ?? teams[1]?.name ?? '',
          date: defaults?.date ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setGames(prev => [...prev, data.game as CupGame]);
      flash(`✅ משחק נוסף ל-${round}`, true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(game: CupGame) {
    setEditingId(game.id);
    setEditDraft({ ...game });
  }

  async function saveEdit() {
    if (!editDraft) return;
    setBusyId(editDraft.id);
    try {
      const res = await fetch('/api/admin/cup-games', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setGames(prev => prev.map(g => g.id === editDraft.id ? editDraft : g));
      setEditingId(null);
      setEditDraft(null);
      flash('✓ נשמר', true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteGame(id: string) {
    if (!confirm('למחוק את המשחק הזה?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/cup-games?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('מחיקה נכשלה');
      setGames(prev => prev.filter(g => g.id !== id));
      flash('🗑 משחק נמחק', true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusyId(null);
    }
  }

  async function addNewRound() {
    const name = prompt('שם הסיבוב החדש (לדוגמה: סיבוב ראשון, רבע גמר, חצי גמר, גמר):');
    if (!name?.trim()) return;
    const orderStr = prompt('סדר תצוגה (מספר — גבוה יותר = מאוחר יותר):', String(rounds.length + 1));
    const order = parseInt(orderStr ?? '', 10);
    if (!Number.isFinite(order)) return;
    await addGame(name.trim(), order);
  }

  // ──────────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-lg font-black text-white">🏆 טורניר הגביע</h2>
        <p className="text-sm text-[#5a7a9a] mt-1">
          נהל את הקבוצות המשתתפות ואת הבראקט (לפי תוצאות ההגרלה).{' '}
          <a href="/cup" target="_blank" className="text-orange-400 hover:underline">/cup ↗</a>
        </p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-bold ${msg.ok ? 'bg-green-900/30 text-green-300 border border-green-600/30' : 'bg-red-900/30 text-red-300 border border-red-600/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Section A — Participating teams */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-black text-white">👥 קבוצות משתתפות</h3>
          <span className="text-xs text-[#5a7a9a]">{selected.size} מתוך {teams.length} נבחרו</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {teams.map((t) => {
            const on = selected.has(t.id);
            return (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                  on
                    ? 'bg-orange-500/15 border-orange-500/40 text-white'
                    : 'bg-white/[0.02] border-white/[0.08] text-[#8aaac8] hover:border-white/[0.15]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleTeam(t.id)}
                  className="accent-orange-500"
                />
                <span className="truncate font-bold">{t.name}</span>
              </label>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveTeams}
            disabled={savingTeams || !teamsChanged}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {savingTeams ? 'שומר...' : 'שמור רשימת קבוצות'}
          </button>
          {teams.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set(teams.map((t) => t.id)))}
              className="rounded-xl border border-white/[0.12] px-4 py-2 text-sm text-[#8aaac8] hover:text-white hover:border-white/20 transition"
            >
              בחר הכל
            </button>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-xl border border-white/[0.12] px-4 py-2 text-sm text-[#8aaac8] hover:text-white hover:border-white/20 transition"
            >
              נקה
            </button>
          )}
        </div>
      </div>

      {/* Section B — Bracket builder */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-black text-white">🏟️ בניית הבראקט</h3>
          <span className="text-xs text-[#5a7a9a]">סה״כ {games.length} משחקים ב-{rounds.length} סיבובים</span>
        </div>

        <p className="text-xs text-[#8aaac8] leading-relaxed">
          הזן את תוצאות ההגרלה: הקבוצה שמוצגת כ&quot;בית&quot; היא זו שזכתה ביתרון הביתי בהגרלה.
          כל סיבוב מנוהל בנפרד — לאחר תום הסיבוב מתבצעת הגרלה חדשה לסיבוב הבא.
        </p>

        {previousWinners && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs">
            <p className="font-black text-emerald-300 mb-1">🏁 מנצחים מ-{previousWinners.roundName}</p>
            <p className="text-[#c0d4e8] leading-relaxed">{previousWinners.winners.join(' · ')}</p>
            <p className="text-[10px] text-[#5a7a9a] mt-1">השתמש ברשימה הזו כשאתה מזין את ההגרלה לסיבוב הבא.</p>
          </div>
        )}

        {rounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center text-sm text-[#5a7a9a]">
            עדיין אין משחקים בבראקט. לחץ &quot;הוסף סיבוב חדש&quot; למטה כדי להתחיל.
          </div>
        ) : (
          rounds.map((group) => (
            <div key={group.round} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-white">
                  {group.round}
                  <span className="text-xs font-bold text-[#5a7a9a] mr-2">· {group.games.length} משחקים</span>
                </h4>
                <button
                  onClick={() => addGame(group.round, group.round_order)}
                  disabled={busyId === 'add'}
                  className="text-xs font-bold text-orange-300 hover:text-orange-200 transition disabled:opacity-40"
                >
                  ➕ הוסף משחק
                </button>
              </div>
              <div className="space-y-2">
                {group.games.map((g) => (
                  <GameRow
                    key={g.id}
                    game={g}
                    teams={teams}
                    isEditing={editingId === g.id}
                    isBusy={busyId === g.id}
                    draft={editDraft && editingId === g.id ? editDraft : null}
                    onDraft={(d) => setEditDraft(d)}
                    onStartEdit={() => startEdit(g)}
                    onCancelEdit={() => { setEditingId(null); setEditDraft(null); }}
                    onSave={saveEdit}
                    onDelete={() => deleteGame(g.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        <button
          onClick={addNewRound}
          disabled={busyId === 'add'}
          className="w-full rounded-xl border border-dashed border-orange-500/40 bg-orange-500/[0.04] px-4 py-3 text-sm font-bold text-orange-300 hover:bg-orange-500/[0.08] disabled:opacity-40 transition"
        >
          ➕ הוסף סיבוב חדש
        </button>
      </div>
    </div>
  );
}

// ── Single game row (display + inline edit) ───────────────────────────────
function GameRow({
  game, teams, isEditing, isBusy, draft, onDraft, onStartEdit, onCancelEdit, onSave, onDelete,
}: {
  game: CupGame;
  teams: Team[];
  isEditing: boolean;
  isBusy: boolean;
  draft: CupGame | null;
  onDraft: (d: CupGame) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  if (isEditing && draft) {
    return (
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/[0.04] p-3 space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-[2fr,2fr,1fr,1fr,1fr,auto] gap-2 items-center text-sm">
          <select
            value={draft.home_team}
            onChange={(e) => onDraft({ ...draft, home_team: e.target.value })}
            className="rounded-md border border-white/[0.1] bg-[#0a1525] px-2 py-1.5 text-white focus:border-orange-500/40 focus:outline-none"
          >
            <option value="" style={{ backgroundColor: '#0a1525' }}>בית</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name} style={{ backgroundColor: '#0a1525' }}>{t.name}</option>
            ))}
          </select>
          <select
            value={draft.away_team}
            onChange={(e) => onDraft({ ...draft, away_team: e.target.value })}
            className="rounded-md border border-white/[0.1] bg-[#0a1525] px-2 py-1.5 text-white focus:border-orange-500/40 focus:outline-none"
          >
            <option value="" style={{ backgroundColor: '#0a1525' }}>חוץ</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name} style={{ backgroundColor: '#0a1525' }}>{t.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={draft.date ?? ''}
            onChange={(e) => onDraft({ ...draft, date: e.target.value || null })}
            className="rounded-md border border-white/[0.1] bg-[#0a1525] px-2 py-1.5 text-white focus:border-orange-500/40 focus:outline-none"
          />
          <input
            type="number"
            placeholder="בית"
            value={draft.home_score ?? ''}
            onChange={(e) => onDraft({ ...draft, home_score: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            className="w-16 rounded-md border border-white/[0.1] bg-[#0a1525] px-2 py-1.5 text-center text-white focus:border-orange-500/40 focus:outline-none"
          />
          <input
            type="number"
            placeholder="חוץ"
            value={draft.away_score ?? ''}
            onChange={(e) => onDraft({ ...draft, away_score: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            className="w-16 rounded-md border border-white/[0.1] bg-[#0a1525] px-2 py-1.5 text-center text-white focus:border-orange-500/40 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#8aaac8]">
            <input
              type="checkbox"
              checked={draft.played}
              onChange={(e) => onDraft({ ...draft, played: e.target.checked })}
              className="accent-orange-500"
            />
            שוחק
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onSave}
            disabled={isBusy || !draft.home_team || !draft.away_team}
            className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-40 transition"
          >
            {isBusy ? 'שומר...' : 'שמור'}
          </button>
          <button
            onClick={onCancelEdit}
            className="rounded-lg border border-white/[0.12] px-3 py-1 text-xs text-[#8aaac8] hover:text-white transition"
          >
            ביטול
          </button>
        </div>
      </div>
    );
  }

  const winner = game.played && game.home_score != null && game.away_score != null
    ? game.home_score > game.away_score ? 'home' : game.away_score > game.home_score ? 'away' : null
    : null;

  return (
    <div className="grid grid-cols-[2fr,auto,2fr,auto,auto,auto] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm">
      <span className={`truncate font-bold ${winner === 'home' ? 'text-orange-400' : 'text-white'}`}>
        {game.home_team}
        <span className="text-[10px] font-bold text-[#5a7a9a] mr-1">בית</span>
      </span>
      <span className="font-stats text-base font-black text-[#8aaac8] tabular-nums">
        {game.played && game.home_score != null && game.away_score != null
          ? `${game.home_score} : ${game.away_score}`
          : 'VS'}
      </span>
      <span className={`truncate font-bold ${winner === 'away' ? 'text-orange-400' : 'text-white'}`}>
        {game.away_team}
        <span className="text-[10px] font-bold text-[#5a7a9a] mr-1">חוץ</span>
      </span>
      <span className="text-xs text-[#5a7a9a] tabular-nums whitespace-nowrap">
        {game.date ? new Date(game.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : '—'}
      </span>
      <button
        onClick={onStartEdit}
        disabled={isBusy}
        title="ערוך"
        className="rounded px-2 py-0.5 text-sm text-green-400 hover:bg-green-900/30 disabled:opacity-40"
      >
        ✏️
      </button>
      <button
        onClick={onDelete}
        disabled={isBusy}
        title="מחק"
        className="rounded px-2 py-0.5 text-sm text-red-400 hover:bg-red-900/30 disabled:opacity-40"
      >
        {isBusy ? '...' : '🗑'}
      </button>
    </div>
  );
}
