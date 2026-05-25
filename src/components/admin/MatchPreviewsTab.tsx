'use client';

import { useMemo, useRef, useState } from 'react';

export type CupGameLite = {
  id: string;
  round: string;
  round_order: number;
  game_number: number;
  home_team: string;
  away_team: string;
  date: string | null;
  played: boolean;
};

export type Preview = {
  id: string;
  cup_game_id: string;
  season: string;
  home_review: string;
  away_review: string;
  is_published: boolean;
  flyer_url: string | null;
};

type Draft = {
  home_review: string;
  away_review: string;
  is_published: boolean;
};

type Props = {
  cupGames: CupGameLite[];
  previews: Preview[];
};

export default function MatchPreviewsTab({ cupGames, previews: initial }: Props) {
  const [previews, setPreviews] = useState<Preview[]>(initial);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const m: Record<string, Draft> = {};
    for (const p of initial) {
      m[p.cup_game_id] = {
        home_review:  p.home_review,
        away_review:  p.away_review,
        is_published: p.is_published,
      };
    }
    return m;
  });
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  // Which cup game the admin is currently editing. Null = nothing picked
  // yet, so we show the picker prompt instead of any editor.
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Flyer upload state per game
  const [flyerPreviews, setFlyerPreviews] = useState<Record<string, string>>({});
  const flyerInputRef = useRef<HTMLInputElement>(null);

  function flash(text: string, ok: boolean) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3500);
  }

  // Order: unplayed first (closest cup matches), then played (history),
  // each block ordered by round_order desc so the latest stage shows up top.
  const orderedGames = useMemo(() => {
    const upcoming = cupGames
      .filter(g => !g.played)
      .sort((a, b) => b.round_order - a.round_order || a.game_number - b.game_number);
    const past = cupGames
      .filter(g => g.played)
      .sort((a, b) => b.round_order - a.round_order || a.game_number - b.game_number);
    return [...upcoming, ...past];
  }, [cupGames]);

  const selectedGame = selectedGameId
    ? orderedGames.find(g => g.id === selectedGameId) ?? null
    : null;

  function getDraft(cupGameId: string): Draft {
    return drafts[cupGameId] ?? { home_review: '', away_review: '', is_published: false };
  }

  function setDraftField(cupGameId: string, field: keyof Draft, value: string | boolean) {
    setDrafts(prev => ({
      ...prev,
      [cupGameId]: { ...getDraft(cupGameId), [field]: value },
    }));
  }

  async function handleGenerate(g: CupGameLite, side: 'home' | 'away') {
    setBusy({ id: g.id, action: `gen-${side}` });
    try {
      const teamName     = side === 'home' ? g.home_team : g.away_team;
      const opponentName = side === 'home' ? g.away_team : g.home_team;
      const res = await fetch('/api/admin/match-previews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName,
          opponentName,
          roundName: g.round,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שגיאה');
      setDraftField(g.id, side === 'home' ? 'home_review' : 'away_review', data.text);
      flash(`✨ נוצר טור עבור ${teamName}`, true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(g: CupGameLite) {
    const draft = getDraft(g.id);
    setBusy({ id: g.id, action: 'save' });
    try {
      const res = await fetch('/api/admin/match-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cup_game_id:  g.id,
          home_review:  draft.home_review,
          away_review:  draft.away_review,
          is_published: draft.is_published,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'שמירה נכשלה');
      setPreviews(prev => {
        const next = prev.filter(p => p.cup_game_id !== g.id);
        next.push(data.preview as Preview);
        return next;
      });
      flash(`💾 נשמר: ${g.home_team} vs ${g.away_team}`, true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusy(null);
    }
  }

  async function handleTogglePublish(g: CupGameLite, nextValue: boolean) {
    const existing = previews.find(p => p.cup_game_id === g.id);
    // If there's nothing saved yet, save first (with the toggle baked in).
    if (!existing) {
      setDraftField(g.id, 'is_published', nextValue);
      await handleSave(g);
      return;
    }
    setBusy({ id: g.id, action: 'publish' });
    try {
      const res = await fetch('/api/admin/match-previews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing.id, is_published: nextValue }),
      });
      if (!res.ok) throw new Error('עדכון נכשל');
      setPreviews(prev => prev.map(p => p.cup_game_id === g.id ? { ...p, is_published: nextValue } : p));
      setDraftField(g.id, 'is_published', nextValue);
      flash(nextValue ? '🟢 פורסם' : '⚫ הוסר מפרסום', true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusy(null);
    }
  }

  async function handleFlyerUpload(g: CupGameLite, file: File) {
    // We need an existing saved row to attach flyer_url to.
    let existing = previews.find(p => p.cup_game_id === g.id);
    if (!existing) {
      // Auto-save a draft row first so we have an id to attach to.
      setBusy({ id: g.id, action: 'flyer' });
      try {
        const res = await fetch('/api/admin/match-previews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cup_game_id:  g.id,
            home_review:  getDraft(g.id).home_review,
            away_review:  getDraft(g.id).away_review,
            is_published: getDraft(g.id).is_published,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'שמירה נכשלה');
        const saved = data.preview as Preview;
        setPreviews(prev => [...prev.filter(p => p.cup_game_id !== g.id), saved]);
        existing = saved;
      } catch (err: unknown) {
        flash(err instanceof Error ? err.message : 'שגיאה בשמירה', false);
        setBusy(null);
        return;
      }
    }

    setBusy({ id: g.id, action: 'flyer' });
    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setFlyerPreviews(prev => ({ ...prev, [g.id]: localUrl }));

      const fd = new FormData();
      fd.append('file', file);
      fd.append('id', existing.id);

      const res = await fetch('/api/admin/match-previews/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'העלאה נכשלה');

      // Persist public URL in local state
      setPreviews(prev =>
        prev.map(p => p.cup_game_id === g.id ? { ...p, flyer_url: data.flyer_url } : p)
      );
      // Replace local blob URL with real one
      setFlyerPreviews(prev => ({ ...prev, [g.id]: data.flyer_url }));
      flash('🖼️ הפלייר הועלה בהצלחה', true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה בהעלאה', false);
      // Revert local preview
      setFlyerPreviews(prev => {
        const copy = { ...prev };
        delete copy[g.id];
        return copy;
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleFlyerRemove(g: CupGameLite) {
    const existing = previews.find(p => p.cup_game_id === g.id);
    if (!existing?.id) return;
    setBusy({ id: g.id, action: 'flyer-remove' });
    try {
      const res = await fetch('/api/admin/match-previews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existing.id, flyer_url: null }),
      });
      if (!res.ok) throw new Error('הסרה נכשלה');
      setPreviews(prev => prev.map(p => p.cup_game_id === g.id ? { ...p, flyer_url: null } : p));
      setFlyerPreviews(prev => {
        const copy = { ...prev };
        delete copy[g.id];
        return copy;
      });
      flash('🗑️ הפלייר הוסר', true);
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'שגיאה', false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div dir="rtl" className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-white">🎤 לקראת המשחק</h2>
        <p className="text-sm text-gray-400 mt-1">
          לכל משחק גביע — כפתור יצירה (פרשנות מקצועית בעברית, נוצרת אוטומטית מ-Gemini מבוססת על נתוני העונה האמיתיים).
          ערוך, שמור, ופרסם כדי שהפרשנות תופיע ב-<a href="/events" target="_blank" className="text-orange-400 hover:underline">/events</a>.
        </p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-bold ${msg.ok ? 'bg-green-900/30 text-green-300 border border-green-600/30' : 'bg-red-900/30 text-red-300 border border-red-600/30'}`}>
          {msg.text}
        </div>
      )}

      {orderedGames.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center text-sm text-[#5a7a9a]">
          אין משחקי גביע בעונה הזו. הוסף משחקים בלשונית &quot;גביע&quot;.
        </div>
      ) : (
        <>
          {/* Match picker — admin chooses ONE game to edit. Groups upcoming
              vs played so the closest match is the obvious default. */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
            <label htmlFor="preview-game-select" className="block text-xs font-black uppercase tracking-widest text-[#8aaac8]">
              בחר משחק לפרשנות
            </label>
            <select
              id="preview-game-select"
              value={selectedGameId ?? ''}
              onChange={(e) => setSelectedGameId(e.target.value || null)}
              className="w-full rounded-lg border border-white/[0.1] bg-[#0a1525] px-3 py-2.5 text-sm text-white focus:border-orange-500/40 focus:outline-none"
            >
              <option value="" style={{ backgroundColor: '#0a1525' }}>— בחר משחק —</option>
              {(() => {
                const upcoming = orderedGames.filter(g => !g.played);
                const past     = orderedGames.filter(g =>  g.played);
                return (
                  <>
                    {upcoming.length > 0 && (
                      <optgroup label="🟠 משחקים קרובים">
                        {upcoming.map((g) => {
                          const hasContent = previews.some(p =>
                            p.cup_game_id === g.id && (p.home_review.trim() || p.away_review.trim())
                          );
                          const published = previews.some(p => p.cup_game_id === g.id && p.is_published);
                          const marker = published ? '🟢' : hasContent ? '✏️' : '⚪';
                          return (
                            <option key={g.id} value={g.id} style={{ backgroundColor: '#0a1525' }}>
                              {marker} {g.round} · {g.home_team} vs {g.away_team}{g.date ? ` · ${g.date}` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    {past.length > 0 && (
                      <optgroup label="⚫ משחקים שעברו">
                        {past.map((g) => {
                          const hasContent = previews.some(p =>
                            p.cup_game_id === g.id && (p.home_review.trim() || p.away_review.trim())
                          );
                          const published = previews.some(p => p.cup_game_id === g.id && p.is_published);
                          const marker = published ? '🟢' : hasContent ? '✏️' : '⚪';
                          return (
                            <option key={g.id} value={g.id} style={{ backgroundColor: '#0a1525' }}>
                              {marker} {g.round} · {g.home_team} vs {g.away_team}{g.date ? ` · ${g.date}` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </>
                );
              })()}
            </select>
            <p className="text-[10px] text-[#5a7a9a]">
              🟢 פורסם · ✏️ טיוטה נשמרה · ⚪ ריק
            </p>
          </div>

          {/* Editor for the selected game. Until something is picked we just
              show a friendly prompt so the page doesn't feel empty. */}
          {!selectedGame ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
              <p className="text-4xl mb-3">🎙️</p>
              <p className="text-sm font-bold text-[#8aaac8]">בחר משחק מהרשימה למעלה כדי לכתוב פרשנות.</p>
            </div>
          ) : (
            (() => {
              const g = selectedGame;
              const draft = getDraft(g.id);
              const existing = previews.find(p => p.cup_game_id === g.id);
              const isBusy = (action: string) => busy?.id === g.id && busy?.action === action;
              const dirty =
                !!existing &&
                (existing.home_review  !== draft.home_review  ||
                 existing.away_review  !== draft.away_review  ||
                 existing.is_published !== draft.is_published);
              const isUnsaved = !existing && (draft.home_review || draft.away_review);

              // Flyer: prefer local preview (optimistic) → saved URL → null
              const currentFlyer =
                flyerPreviews[g.id] ??
                existing?.flyer_url ??
                null;
              const flyerBusy = isBusy('flyer') || isBusy('flyer-remove');

              return (
                <div
                  className={`rounded-2xl border p-5 space-y-4 ${
                    g.played
                      ? 'border-white/[0.05] bg-white/[0.01] opacity-90'
                      : 'border-orange-500/30 bg-orange-500/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                          🏆 {g.round}
                        </span>
                        {!g.played && (
                          <span className="inline-flex items-center rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-orange-300">
                            קרוב
                          </span>
                        )}
                        {g.played && (
                          <span className="inline-flex items-center rounded-full bg-gray-500/15 border border-gray-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            שוחק
                          </span>
                        )}
                        {g.date && (
                          <span className="text-xs font-bold text-[#8aaac8] tabular-nums">
                            {g.date}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-black text-white font-heading">
                        {g.home_team} <span className="text-[#5a7a9a]">vs</span> {g.away_team}
                      </h3>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-[#8aaac8]">פרסם ב-/events</span>
                      <input
                        type="checkbox"
                        checked={draft.is_published}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setDraftField(g.id, 'is_published', next);
                          handleTogglePublish(g, next);
                        }}
                        disabled={isBusy('publish')}
                        className="h-4 w-4 accent-orange-500"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ReviewBox
                      label={`📝 ${g.home_team} (בית)`}
                      value={draft.home_review}
                      onChange={(v) => setDraftField(g.id, 'home_review', v)}
                      onGenerate={() => handleGenerate(g, 'home')}
                      generating={isBusy('gen-home')}
                    />
                    <ReviewBox
                      label={`📝 ${g.away_team} (חוץ)`}
                      value={draft.away_review}
                      onChange={(v) => setDraftField(g.id, 'away_review', v)}
                      onGenerate={() => handleGenerate(g, 'away')}
                      generating={isBusy('gen-away')}
                    />
                  </div>

                  {/* ── Flyer upload ─────────────────────────────────────── */}
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-[#8aaac8]">
                      🖼️ פלייר / עלון
                    </p>

                    {currentFlyer ? (
                      <div className="flex items-start gap-4 flex-wrap">
                        {/* Thumbnail */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentFlyer}
                          alt="פלייר"
                          className="h-32 w-auto max-w-[160px] rounded-lg border border-white/[0.1] object-cover shadow-lg"
                        />
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-[#8aaac8]">הפלייר יוצג בדף /events מעל פרשנות המשחק.</p>
                          <div className="flex gap-2">
                            {/* Replace */}
                            <label className={`cursor-pointer rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[#c8d8e8] hover:bg-white/[0.08] transition ${flyerBusy ? 'opacity-40 cursor-not-allowed' : ''}`}>
                              {flyerBusy ? '⏳ ...' : '🔄 החלף'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                disabled={flyerBusy}
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handleFlyerUpload(g, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {/* Remove */}
                            <button
                              onClick={() => handleFlyerRemove(g)}
                              disabled={flyerBusy}
                              className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/[0.18] transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              🗑️ הסר
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] px-4 py-6 cursor-pointer hover:border-orange-500/40 hover:bg-orange-500/[0.03] transition ${flyerBusy ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                        <span className="text-3xl">{flyerBusy ? '⏳' : '📎'}</span>
                        <span className="text-xs font-bold text-[#8aaac8] text-center">
                          {flyerBusy ? 'מעלה פלייר...' : 'לחץ להעלאת פלייר (JPG / PNG / WEBP)'}
                        </span>
                        <span className="text-[10px] text-[#5a7a9a]">הפלייר יוצג בראש כרטיס המשחק ב-/events</span>
                        <input
                          ref={flyerInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={flyerBusy}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleFlyerUpload(g, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                    <p className="text-[11px] text-[#5a7a9a]">
                      {existing ? 'יש גרסה שמורה' : 'טיוטה לא שמורה'}
                      {dirty && <span className="text-orange-400 font-bold ms-2">· שינויים לא שמורים</span>}
                      {isUnsaved && <span className="text-orange-400 font-bold ms-2">· לא נשמר עדיין</span>}
                    </p>
                    <button
                      onClick={() => handleSave(g)}
                      disabled={isBusy('save') || (!dirty && !isUnsaved)}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {isBusy('save') ? '⏳ שומר...' : '💾 שמור'}
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}

function ReviewBox({
  label, value, onChange, onGenerate, generating,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#c8d8e8]">{label}</span>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="rounded-lg border border-orange-500/40 bg-orange-500/[0.08] px-3 py-1 text-xs font-bold text-orange-300 hover:bg-orange-500/[0.18] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? '⏳ מייצר...' : '✨ צור פרשנות'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        placeholder="הפרשנות תופיע כאן אחרי לחיצה על &quot;✨ צור פרשנות&quot;. אפשר גם לכתוב ידנית.&#10;&#10;תומך ב-markdown: **מודגש** וגם תבליטים שמתחילים ב- (מינוס)."
        className="w-full rounded-lg border border-white/[0.1] bg-[#0a1525] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500/40 focus:outline-none resize-y leading-relaxed font-mono"
      />
      <p className="text-[10px] text-[#5a7a9a]">
        {value.length} תווים · ~{Math.round(value.split(/\s+/).filter(Boolean).length)} מילים
      </p>
    </div>
  );
}
