'use client';

import { useState, useTransition } from 'react';
import { saveCupSetting } from '@/app/admin/actions';

type Team = { id: string; name: string };

type Props = {
  date: string;       // ISO yyyy-mm-dd
  location: string;
  teamIds: string[];  // selected team UUIDs
  teams: Team[];      // all teams in the league
};

export default function CupTab({ date: dInit, location: lInit, teamIds: tInit, teams }: Props) {
  const [date, setDate] = useState(dInit);
  const [location, setLocation] = useState(lInit);
  const [selected, setSelected] = useState<Set<string>>(new Set(tInit));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function save(key: 'cup_tournament_date' | 'cup_tournament_location' | 'cup_tournament_teams', value: string) {
    setSavingKey(key);
    setMsg(null);
    startTransition(async () => {
      const result = await saveCupSetting(key, value);
      setSavingKey(null);
      if (result.error) setMsg({ ok: false, text: result.error });
      else setMsg({ ok: true, text: '✓ נשמר' });
      setTimeout(() => setMsg(null), 2500);
    });
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
    save('cup_tournament_teams', JSON.stringify([...selected]));
  }

  const teamsChanged = JSON.stringify([...selected].sort()) !== JSON.stringify([...tInit].sort());

  return (
    <div dir="rtl" className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-black text-white">🏆 טורניר הגביע</h2>
        <p className="text-sm text-[#5a7a9a] mt-1">
          תאריך, מיקום וקבוצות משתתפות. הנתונים יוצגו בעמוד הציבורי{' '}
          <a href="/cup" target="_blank" className="text-orange-400 hover:underline">/cup ↗</a>
          .
        </p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-bold ${msg.ok ? 'bg-green-900/30 text-green-300 border border-green-600/30' : 'bg-red-900/30 text-red-300 border border-red-600/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Date */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <h3 className="text-base font-black text-white">📅 תאריך הטורניר</h3>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-white/[0.08] bg-[#0a1525] px-4 py-2 text-sm text-white focus:border-orange-500/40 focus:outline-none"
          />
          <button
            onClick={() => save('cup_tournament_date', date)}
            disabled={savingKey === 'cup_tournament_date' || date === dInit}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {savingKey === 'cup_tournament_date' ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <h3 className="text-base font-black text-white">📍 מיקום</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="לדוגמה: היכל הספורט אשדוד"
            className="flex-1 rounded-xl border border-white/[0.08] bg-[#0a1525] px-4 py-2 text-sm text-white placeholder:text-[#3a5a7a] focus:border-orange-500/40 focus:outline-none"
          />
          <button
            onClick={() => save('cup_tournament_location', location)}
            disabled={savingKey === 'cup_tournament_location' || location === lInit}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {savingKey === 'cup_tournament_location' ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>

      {/* Teams */}
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
            disabled={savingKey === 'cup_tournament_teams' || !teamsChanged}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {savingKey === 'cup_tournament_teams' ? 'שומר...' : 'שמור רשימת קבוצות'}
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
    </div>
  );
}
