import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getClientIp(request: NextRequest | Request): string {
  const headers = 'headers' in request ? request.headers : new Headers();
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip')?.trim() ?? '';
}

export function isTrustedIp(ip: string): boolean {
  if (!ip) return false;
  const list = (process.env.ADMIN_TRUSTED_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(ip);
}

export async function getAal(
  supabase: SupabaseClient,
): Promise<'aal1' | 'aal2' | null> {
  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  return (data.currentLevel as 'aal1' | 'aal2' | null) ?? null;
}
