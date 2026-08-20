import { db } from './geonic';
import type { CurrentUser } from './types';

async function loadCurrentUser(): Promise<CurrentUser> {
  const me = (await db.request('GET', '/me')) as Record<string, unknown>;
  const email = String(me.email ?? '');
  const name = typeof me.name === 'string' && me.name.trim() ? me.name : email.split('@')[0];
  return { email, name };
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  await db.login(email, password, { rememberSession: true });
  return loadCurrentUser();
}

/** Returns the signed-in user when a persisted session was rehydrated. */
export async function restore(): Promise<CurrentUser | null> {
  const restored = await db.restoreSession();
  if (!restored) return null;
  try {
    return await loadCurrentUser();
  } catch {
    // Persisted session is stale — fall back to the login form.
    return null;
  }
}

export async function logout(): Promise<void> {
  db.disconnect();
  await db.logout();
}
