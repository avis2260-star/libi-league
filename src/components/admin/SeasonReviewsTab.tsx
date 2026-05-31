'use client';

import { useEffect, useState } from 'react';

type FocusGame = {
  competition: 'league' | 'cup' | 'playoff';
  label: string;
  round: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  date: string | null;
};

export type SeasonReview = {
  id: string;
  season: string;
  review_type: 'pre_season' | 'mid_season' | 'end_season' | 'custom';
  title: string;
  content: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  reviews: SeasonReview[];
  season: string;
  knownSeasons: string[];
};

const TYPE_META: Record<SeasonReview['review_type'], { label: string; emoji: string; color: string }> = {
  pre_season: { label: 'פתיחת עונה',  emoji: '🌱', color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  mid_season: { label: 'מחצית עונה', emoji: '⏸',  color: 'text-blue-300   border-blue-500/40   bg-blue-500/10'   },
  end_season: { label: 'סיום עונה',   emoji: '🏆', color: 'text-amber-300  border-amber-500/40  bg-amber-500/10'  },
  custom:     { label: 'חופשי',        emoji: '✏️', color: 'text-[#8aaac8]  border-white/20      bg-white/[0.04]'  },
};

const REVIEW_TYPES = Object.entries(TYPE_META) as [SeasonReview['review_type'], typeof TYPE_META[keyof typeof TYPE_META]][];

export default function SeasonReviewsTab({ reviews: initial, season: currentSeason, knownSeasons }: Props) {
  const [reviews, setReviews]       = useState<SeasonReview[]>(initial);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create / generate panel state
  const [genType,    setGenType]    = useState<SeasonReview['review_type']>('end_season');
  const [genSeason,  setGenSeason]  = useState(currentSeason);
  const [genNotes,   setGenNotes]   = useState('');
  const [generating, setGenerating] = useState(false);

  // Focus-on-a-specific-game (only for the free "custom" type).
  const [focusGames, setFocusGames] = useState<FocusGame[]>([]);
  const [focusIdx,   setFocusIdx]   = useState<number | ''>('');
  const [loadingFocus, setLoadingFocus] = useState(false);

  // Load the season's games/events when the free type + create panel are open.
  useEffect(() => {
    if (!showCreate || genType !== 'custom') {
      setFocusGames([]);
      setFocusIdx('');
      return;
    }
    let cancelled = false;
    setLoadingFocus(true);
    fetch(`/api/admin/season-reviews/games?season=${encodeURIComponent(genSeason)}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { setFocusGames((j.games ?? []) as FocusGame[]); setFocusIdx(''); } })
      .catch(() => { if (!cancelled) setFocusGames([]); })
      .finally(() => { if (!cancelled) setLoadingFocus(false); });
    return () => { cancelled = true; };
  }, [showCreate, genType, genSeason]);

  // Edit draft state
  const [draftTitle,   setDraftTitle]   = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftPub,     setDraftPub]     = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  function flash(text: string, ok = true) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3500);
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  type GenParams = {
    reviewType: SeasonReview['review_type'];
    season: string;
    customNotes: string;
    focus: FocusGame | null;
  };
  // Remembers the params of the last generation so "🔄 צור מחדש" can re-run
  // the exact same request (same type / season / focus) from the editor.
  const [lastGen, setLastGen] = useState<GenParams | null>(null);

  async function runGenerate(params: GenParams) {
    setGenerating(true);
    try {
      const res  = await fetch('/api/admin/season-reviews/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'שגיאת AI');
      // Pre-fill draft with AI result and switch to create mode.
      setDraftTitle(json.title ?? '');
      setDraftContent(json.text ?? '');
      setDraftPub(false);
      setEditingId('__new__');
      setShowCreate(false);
      setLastGen(params);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'שגיאה', false);
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerate() {
    runGenerate({
      reviewType:  genType,
      season:      genSeason,
      customNotes: genNotes,
      focus:       genType === 'custom' && focusIdx !== '' ? focusGames[focusIdx] : null,
    });
  }

  function handleRegenerate() {
    if (!lastGen) return;
    if (draftContent.trim() &&
        !confirm('פעולה זו תיצור טקסט חדש שיחליף את הנוכחי. להמשיך?')) {
      return;
    }
    runGenerate(lastGen);
  }

  // ── Save new ──────────────────────────────────────────────────────────────
  async function handleSaveNew(publish: boolean) {
    setBusy(true);
    try {
      const res  = await fetch('/api/admin/season-reviews', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season:       genSeason,
          review_type:  genType,
          title:        draftTitle,
          content:      draftContent,
          is_published: publish,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'שגיאה');
      setReviews(prev => [json.review as SeasonReview, ...prev]);
      setEditingId(null);
      flash(publish ? '✅ הסקירה פורסמה' : '✅ נשמרה כטיוטה');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'שגיאה', false);
    } finally {
      setBusy(false);
    }
  }

  // ── Start editing existing ────────────────────────────────────────────────
  function startEdit(r: SeasonReview) {
    setEditingId(r.id);
    setDraftTitle(r.title);
    setDraftContent(r.content);
    setDraftPub(r.is_published);
    setShowCreate(false);
  }

  // ── Save existing ─────────────────────────────────────────────────────────
  async function handleSaveEdit(publish?: boolean) {
    if (!editingId || editingId === '__new__') return;
    setBusy(true);
    try {
      const res  = await fetch('/api/admin/season-reviews', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:           editingId,
          title:        draftTitle,
          content:      draftContent,
          is_published: publish ?? draftPub,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'שגיאה');
      setReviews(prev => prev.map(r =>
        r.id === editingId
          ? { ...r, title: draftTitle, content: draftContent, is_published: publish ?? draftPub }
          : r
      ));
      if (publish !== undefined) setDraftPub(publish);
      flash(publish ? '✅ פורסם' : '✅ נשמר');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'שגיאה', false);
    } finally {
      setBusy(false);
    }
  }

  // ── Toggle publish ────────────────────────────────────────────────────────
  async function togglePublish(r: SeasonReview) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/season-reviews', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, is_published: !r.is_published }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'שגיאה');
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, is_published: !x.is_published } : x));
      if (editingId === r.id) setDraftPub(!r.is_published);
      flash(!r.is_published ? '🌐 פורסם' : '🔒 הוסתר');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'שגיאה', false);
    } finally {
      setBusy(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('למחוק את הסקירה?')) return;
    setBusy(true);
    try {
      const res  = await fetch(`/api/admin/season-reviews?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'שגיאה');
      setReviews(prev => prev.filter(r => r.id !== id));
      if (editingId === id) setEditingId(null);
      flash('🗑️ נמחק');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'שגיאה', false);
    } finally {
      setBusy(false);
    }
  }

  const isEditingNew = editingId === '__new__';

  return (
    <div dir="rtl" className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-white font-heading">📰 סקירות עונה</h2>
          <p className="text-xs text-[#5a7a9a] mt-0.5">
            מאמרי ניתוח עונתיים — נוצרים עם AI על בסיס נתוני הליגה האמיתיים.
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setEditingId(null); }}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500/20 border border-orange-500/40 px-4 py-2 text-sm font-black text-orange-300 hover:bg-orange-500/30 transition"
        >
          ✨ סקירה חדשה
        </button>
      </div>

      {/* ── Flash message ──────────────────────────────────────────────── */}
      {msg && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${msg.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* ── Create / Generate panel ─────────────────────────────────────── */}
      {showCreate && (
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/[0.06] p-5 space-y-4">
          <p className="text-sm font-black text-orange-200">✨ יצירת סקירה חדשה עם AI</p>

          {/* Type selector */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[#5a7a9a] uppercase tracking-widest">סוג הסקירה</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REVIEW_TYPES.map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => setGenType(type)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-black text-center transition ${
                    genType === type
                      ? `${meta.color} ring-1 ring-current`
                      : 'border-white/[0.08] bg-white/[0.02] text-[#6b8aaa] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="block text-base mb-0.5">{meta.emoji}</span>
                  {meta.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#4a6a8a]">
              {genType === 'pre_season' && '🌱 ישתמש בנתוני העונה הקודמת ובהיסטוריה — לכתיבה לפני תחילת עונה.'}
              {genType === 'mid_season' && '⏸ ישתמש בנתוני העונה הנוכחית עד כה — לפסק בין הסיבובים.'}
              {genType === 'end_season' && '🏆 ישתמש בנתוני העונה המלאים — לסיכום בסוף העונה.'}
              {genType === 'custom'     && '✏️ ישתמש בכל הנתונים הזמינים — ניתן להוסיף הנחיות ידניות.'}
            </p>
          </div>

          {/* Season selector */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[#5a7a9a] uppercase tracking-widest">עונה לסקירה</p>
            <select
              value={genSeason}
              onChange={e => setGenSeason(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0f1e30] px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none"
            >
              {knownSeasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Focus on a specific game / event — free type only */}
          {genType === 'custom' && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#5a7a9a] uppercase tracking-widest">
                התמקד במשחק / אירוע ספציפי <span className="normal-case font-normal">(אופציונלי)</span>
              </p>
              <select
                value={focusIdx}
                onChange={e => setFocusIdx(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={loadingFocus}
                className="w-full rounded-xl border border-white/[0.09] bg-[#0f1e30] px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none disabled:opacity-50"
              >
                <option value="">
                  {loadingFocus ? 'טוען משחקים…' : '— סקירה כללית (ללא משחק ספציפי) —'}
                </option>
                {focusGames.map((g, i) => (
                  <option key={i} value={i} style={{ backgroundColor: '#0f1e30' }}>{g.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-[#4a6a8a]">
                {focusIdx !== ''
                  ? '✨ ה-AI יכתוב כתבה הממוקדת אך ורק במשחק שנבחר.'
                  : focusGames.length > 0
                    ? 'בחר משחק כדי שה-AI יכתוב כתבה ממוקדת עליו בלבד.'
                    : loadingFocus ? '' : 'אין משחקים עם תוצאה בעונה זו — תיווצר סקירה כללית.'}
              </p>
            </div>
          )}

          {/* Custom notes */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-[#5a7a9a] uppercase tracking-widest">
              הנחיות נוספות לכותב AI <span className="normal-case font-normal">(אופציונלי)</span>
            </p>
            <textarea
              value={genNotes}
              onChange={e => setGenNotes(e.target.value)}
              rows={3}
              placeholder="לדוגמה: תתמקד בקבוצת האלוף, הדגש את הפתעות הגביע, ציין שחקנים חדשים..."
              className="w-full resize-none rounded-xl border border-white/[0.09] bg-[#0f1e30] px-3 py-2 text-sm text-white placeholder-[#3a5a7a] focus:border-orange-500/50 focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 rounded-xl bg-orange-500/20 border border-orange-500/40 px-4 py-2.5 text-sm font-black text-orange-300 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {generating ? '⏳ יוצר עם AI...' : '✨ צור סקירה'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-bold text-[#6b8aaa] hover:bg-white/[0.06] transition"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* ── Editor (new or existing) ─────────────────────────────────────── */}
      {editingId && (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black text-white">
              {isEditingNew ? '📝 סקירה חדשה — עריכה לפני שמירה' : '✏️ עריכת סקירה'}
            </p>
            <button
              onClick={() => setEditingId(null)}
              className="text-xs text-[#5a7a9a] hover:text-white transition"
            >
              ✕ סגור
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-[#5a7a9a] uppercase tracking-widest">כותרת</p>
            <input
              type="text"
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              className="w-full rounded-xl border border-white/[0.09] bg-[#0f1e30] px-3 py-2 text-sm font-bold text-white focus:border-orange-500/50 focus:outline-none"
            />
          </div>

          {/* Content */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-[#5a7a9a] uppercase tracking-widest">תוכן</p>
            <textarea
              value={draftContent}
              onChange={e => setDraftContent(e.target.value)}
              rows={16}
              className="w-full resize-y rounded-xl border border-white/[0.09] bg-[#0f1e30] px-3 py-2 text-sm text-white placeholder-[#3a5a7a] focus:border-orange-500/50 focus:outline-none font-mono leading-relaxed"
            />
            <p className="text-[9px] text-[#3a5a7a]">תומך בפורמט Markdown: **bold**, - bullets, ## כותרות</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {lastGen && (
              <button
                onClick={handleRegenerate}
                disabled={generating || busy}
                title="צור מחדש עם אותם הגדרות (סוג / עונה / משחק ממוקד)"
                className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-black text-orange-300 hover:bg-orange-500/20 disabled:opacity-50 transition"
              >
                {generating ? '⏳ יוצר...' : '🔄 צור מחדש'}
              </button>
            )}
            {isEditingNew ? (
              <>
                <button
                  onClick={() => handleSaveNew(false)}
                  disabled={busy}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm font-bold text-[#8aaac8] hover:bg-white/[0.06] disabled:opacity-50 transition"
                >
                  💾 שמור כטיוטה
                </button>
                <button
                  onClick={() => handleSaveNew(true)}
                  disabled={busy}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                >
                  🌐 שמור ופרסם
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSaveEdit()}
                  disabled={busy}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm font-bold text-[#8aaac8] hover:bg-white/[0.06] disabled:opacity-50 transition"
                >
                  💾 שמור שינויים
                </button>
                <button
                  onClick={() => handleSaveEdit(!draftPub)}
                  disabled={busy}
                  className={`rounded-xl border px-4 py-2 text-sm font-black disabled:opacity-50 transition ${
                    draftPub
                      ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                >
                  {draftPub ? '🔒 הסתר מהציבור' : '🌐 פרסם'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Reviews list ──────────────────────────────────────────────────── */}
      {reviews.length === 0 && !showCreate && !editingId ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-14 text-center">
          <p className="text-4xl mb-2">📰</p>
          <p className="text-sm font-bold text-[#5a7a9a]">אין סקירות עונה עדיין.</p>
          <p className="text-xs text-[#3a5a7a] mt-1">לחץ על "סקירה חדשה" כדי ליצור עם AI.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => {
            const meta = TYPE_META[r.review_type];
            const isEditing = editingId === r.id;
            return (
              <div
                key={r.id}
                className={`rounded-2xl border p-4 transition ${
                  isEditing
                    ? 'border-orange-500/40 bg-orange-500/[0.05]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${meta.color}`}>
                      {meta.emoji} {meta.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                      r.is_published
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/[0.08] bg-white/[0.03] text-[#5a7a9a]'
                    }`}>
                      {r.is_published ? '🌐 מפורסם' : '🔒 טיוטה'}
                    </span>
                    <span className="text-[10px] text-[#3a5a7a]" dir="ltr">{r.season}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => isEditing ? setEditingId(null) : startEdit(r)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-bold text-[#8aaac8] hover:bg-white/[0.06] transition"
                    >
                      {isEditing ? '✕' : '✏️ ערוך'}
                    </button>
                    <button
                      onClick={() => togglePublish(r)}
                      disabled={busy}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 transition ${
                        r.is_published
                          ? 'border-red-500/30 bg-red-500/[0.06] text-red-400 hover:bg-red-500/15'
                          : 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400 hover:bg-emerald-500/15'
                      }`}
                    >
                      {r.is_published ? '🔒 הסתר' : '🌐 פרסם'}
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={busy}
                      className="rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-1.5 text-xs font-bold text-red-400/70 hover:bg-red-500/15 disabled:opacity-50 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {r.title && (
                  <p className="mt-2 text-sm font-black text-white leading-snug line-clamp-1">{r.title}</p>
                )}
                {r.content && (
                  <p className="mt-1 text-xs text-[#5a7a9a] leading-relaxed line-clamp-2">{r.content}</p>
                )}
                <p className="mt-2 text-[9px] text-[#2a4a6a]">
                  עודכן {new Date(r.updated_at).toLocaleDateString('he-IL')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
