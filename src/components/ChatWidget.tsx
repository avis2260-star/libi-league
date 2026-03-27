'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    setStreaming('');
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (res.status === 429) {
        setError('יותר מדי בקשות — נסה שוב עוד דקה.');
        setLoading(false);
        return;
      }
      if (!res.ok || !res.body) {
        setError('שגיאה בשרת. נסה שוב.');
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      // Read streaming chunks
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreaming(full);
      }

      if (!full.trim()) {
        setError('לא התקבלה תשובה מהשרת. נסה שוב.');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: full }]);
      }
      setStreaming('');
    } catch {
      setError('בעיית חיבור. בדוק את האינטרנט ונסה שוב.');
    } finally {
      setLoading(false);
    }
  }

  const SUGGESTED = [
    'מי מוביל בניקוד?',
    'מתי המשחק הבא?',
    'מה הם המשחקים הקרובים?',
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="flex w-80 sm:w-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1e30] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          style={{ height: 480 }}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between bg-gradient-to-l from-orange-700 to-orange-600 px-4 py-3">
            <div>
              <p className="text-sm font-black text-white">עוזר ליגת ליבי 🏀</p>
              <p className="text-[10px] text-orange-200">שאל על שחקנים, קבוצות ומשחקים</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="סגור צ׳אט"
              className="rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {/* Empty state with suggestions */}
            {messages.length === 0 && !streaming && (
              <div className="mt-6 text-center">
                <p className="mb-1 text-2xl">🏀</p>
                <p className="text-sm text-[#8aaac8]">שלום! כיצד אוכל לעזור?</p>
                <div className="mt-4 flex flex-col gap-2">
                  {SUGGESTED.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[#8aaac8] transition hover:border-orange-500/30 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation */}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/[0.07] text-[#e8edf5]'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Streaming assistant response */}
            {streaming && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-white/[0.07] px-3 py-2 text-sm leading-relaxed text-[#e8edf5]">
                  {streaming}
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-orange-400" />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {loading && !streaming && (
              <div className="flex justify-end">
                <div className="rounded-2xl bg-white/[0.07] px-4 py-2 text-sm text-[#5a7a9a]">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                  </span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="shrink-0 border-t border-white/10 p-3"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="כתוב שאלה..."
                maxLength={1000}
                disabled={loading}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-[#4a6a8a] outline-none transition focus:border-orange-500/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-orange-500 disabled:opacity-40"
              >
                שלח
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Toggle button ────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'סגור צ׳אט' : 'פתח עוזר ליגה'}
        className={`flex items-center gap-2 rounded-full px-4 py-3 font-black text-white shadow-lg transition-all duration-200 ${
          open
            ? 'bg-[#1a2a3a] border border-white/10 hover:bg-[#243040]'
            : 'bg-orange-600 hover:bg-orange-500 hover:shadow-[0_4px_20px_rgba(255,107,26,0.4)]'
        }`}
      >
        <span className="text-xl">{open ? '✕' : '🏀'}</span>
        {!open && <span className="text-sm">עוזר הליגה</span>}
      </button>
    </div>
  );
}
