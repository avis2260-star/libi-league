'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData): Promise<{ error: string } | never> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const next = (formData.get('next') as string | null) ?? '/admin';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function logoutAction(): Promise<never> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
