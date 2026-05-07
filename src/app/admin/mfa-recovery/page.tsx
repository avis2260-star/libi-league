import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { removeMfaFactorsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function MfaRecoveryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <span className="text-4xl">🛟</span>
        <h1 className="text-2xl font-bold text-white">Reset Authenticator</h1>
        <p className="text-sm text-gray-400">
          Signed in as <span className="font-mono">{user.email}</span>. Removing
          your authenticator will require you to re-enroll on the next admin
          login.
        </p>
        <form action={removeMfaFactorsAction}>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
          >
            Remove authenticator and re-enroll
          </button>
        </form>
      </div>
    </div>
  );
}
