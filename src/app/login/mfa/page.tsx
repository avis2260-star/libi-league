import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import MfaEnrollForm from './MfaEnrollForm';
import MfaVerifyForm from './MfaVerifyForm';

export const dynamic = 'force-dynamic';

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? '/admin';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/login/mfa')}`);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl font-extrabold text-orange-500">🔐</span>
          <h1 className="mt-2 text-2xl font-bold text-white">
            {verifiedTotp ? 'Two-Factor Code' : 'Set Up Two-Factor'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {verifiedTotp
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Scan the QR with your authenticator app to finish setup.'}
          </p>
        </div>

        {verifiedTotp ? (
          <MfaVerifyForm factorId={verifiedTotp.id} next={next} />
        ) : (
          <MfaEnrollForm next={next} />
        )}
      </div>
    </div>
  );
}
