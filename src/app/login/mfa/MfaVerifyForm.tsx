'use client';

import { useState, useTransition } from 'react';
import { sendRecoveryLinkAction, verifyMfaAction } from './actions';

interface Props {
  factorId: string;
  next: string;
}

export default function MfaVerifyForm({ factorId, next }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setInfo('');
    startTransition(async () => {
      const result = await verifyMfaAction(factorId, code, next);
      if (result?.error) setError(result.error);
    });
  }

  function handleRecovery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      await sendRecoveryLinkAction(recoveryEmail);
      setInfo(
        'If that email is an admin, a recovery link has been sent. Check your inbox.',
      );
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-gray-300"
            htmlFor="code"
          >
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
            autoFocus
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-900/40 px-4 py-2.5 text-sm text-red-400">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-emerald-900/40 px-4 py-2.5 text-sm text-emerald-300">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || code.length !== 6}
          className="mt-2 h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
        >
          {isPending ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <div className="border-t border-gray-800 pt-4 text-center">
        {!showRecovery ? (
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            className="text-sm text-gray-400 underline hover:text-gray-200"
          >
            Forgot authenticator?
          </button>
        ) : (
          <form onSubmit={handleRecovery} className="space-y-2 text-left">
            <label
              className="block text-sm font-medium text-gray-300"
              htmlFor="recoveryEmail"
            >
              Admin email
            </label>
            <input
              id="recoveryEmail"
              type="email"
              required
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-gray-700 bg-gray-900 px-3 text-sm text-white"
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-11 w-full rounded-xl border border-gray-700 text-sm text-gray-200 hover:border-gray-500 disabled:opacity-60"
            >
              {isPending ? 'Sending…' : 'Send recovery link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
