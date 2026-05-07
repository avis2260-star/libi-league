'use client';

import { useEffect, useState, useTransition } from 'react';
import { enrollMfaAction, verifyMfaAction } from './actions';

interface Props {
  next: string;
}

export default function MfaEnrollForm({ next }: Props) {
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    enrollMfaAction().then((res) => {
      if ('error' in res) setError(res.error);
      else {
        setFactorId(res.factorId);
        setQr(res.qr);
        setSecret(res.secret);
      }
      setLoading(false);
    });
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const result = await verifyMfaAction(factorId, code, next);
      if (result?.error) setError(result.error);
    });
  }

  if (loading) {
    return <p className="text-center text-gray-400">Loading…</p>;
  }
  if (!factorId) {
    return (
      <p className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm text-red-400">
        {error || 'Could not start enrollment.'}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-center rounded-xl bg-white p-4">
        {/* Supabase returns an SVG data URL */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="MFA QR code" className="h-48 w-48" />
      </div>
      <p className="break-all text-center text-xs text-gray-500">
        Manual key: <span className="font-mono">{secret}</span>
      </p>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300" htmlFor="code">
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="h-12 w-full rounded-xl border border-gray-700 bg-gray-900 px-4 text-center text-base tracking-widest text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          placeholder="123456"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || code.length !== 6}
        className="mt-2 h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Verifying…' : 'Activate Two-Factor'}
      </button>
    </form>
  );
}
