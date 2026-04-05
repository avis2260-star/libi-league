'use client';

import { useState, useTransition } from 'react';
import { markMessageRead } from '@/app/admin/actions';

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function MessagesTab({ messages: initial }: { messages: ContactMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [, startTransition] = useTransition();

  function openMessage(msg: ContactMessage) {
    setSelected(msg);
    if (!msg.is_read) {
      startTransition(async () => {
        await markMessageRead(msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      });
    }
  }

  const unread = messages.filter(m => !m.is_read).length;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-black text-white">📬 הודעות</h2>
        {unread > 0 && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
            {unread} חדשות
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-[#5a7a9a]">אין הודעות עדיין</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => openMessage(msg)}
              className={`w-full text-right rounded-2xl border px-4 py-4 transition-all ${
                selected?.id === msg.id
                  ? 'border-orange-500/40 bg-orange-500/[0.08]'
                  : msg.is_read
                  ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                  : 'border-orange-500/20 bg-orange-500/[0.04] hover:border-orange-500/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!msg.is_read && (
                      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    )}
                    <span className="font-bold text-white text-sm">{msg.name}</span>
                    <span className="text-[#5a7a9a] text-xs">{msg.email}</span>
                  </div>
                  <p className="text-[#8aaac8] text-xs mt-1 truncate">{msg.message}</p>
                </div>
                <span className="text-[10px] text-[#3a5a7a] shrink-0 mt-0.5">
                  {new Date(msg.created_at).toLocaleDateString('he-IL', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Expanded message */}
              {selected?.id === msg.id && (
                <div className="mt-3 pt-3 border-t border-white/[0.06] text-right">
                  <p className="text-xs font-black text-[#3a5a7a] mb-1">ההודעה המלאה:</p>
                  <p className="text-sm text-[#c0d4e8] whitespace-pre-wrap">{msg.message}</p>
                  <a
                    href={`mailto:${msg.email}?subject=RE: פנייתך לליגת ליבי`}
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 mt-3 rounded-lg bg-orange-500 hover:bg-orange-400 transition px-3 py-1.5 text-xs font-bold text-white"
                  >
                    ↩ השב למייל
                  </a>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
