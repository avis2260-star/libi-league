'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';

export async function removeMfaFactorsAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (
    adminEmails.length > 0 &&
    !adminEmails.includes(user.email?.toLowerCase() ?? '')
  ) {
    redirect('/403');
  }

  const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: user.id,
  });

  for (const f of factors?.factors ?? []) {
    await supabaseAdmin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: f.id,
    });
  }

  redirect('/login/mfa');
}
