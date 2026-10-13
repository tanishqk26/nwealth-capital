import { pbkdf2Sync, randomBytes } from 'crypto';
import { db } from '@/lib/supabase';

const ITERATIONS = 100_000;
const KEYLEN = 64;
const DIGEST = 'sha512';

/**
 * Hash a plaintext password.
 * Returns "salt:hash" (both hex-encoded).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return hash === storedHash;
}

/**
 * Round-robin assignment: returns the id of the next active team member,
 * or null if no active members exist.
 */
export async function assignLeadToNext(): Promise<string | null> {
  const { data, error } = await db
    .from('team_members')
    .select('id')
    .eq('status', 'active')
    .order('last_assigned_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  await db
    .from('team_members')
    .update({ last_assigned_at: new Date().toISOString() })
    .eq('id', data.id);

  return data.id;
}
