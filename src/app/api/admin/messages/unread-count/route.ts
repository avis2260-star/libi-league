import { requireAdmin } from '@/lib/require-admin';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Unread contact-messages (פניות) count — polled by AdminNav for its badge.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { count, error } = await supabaseAdmin
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}
