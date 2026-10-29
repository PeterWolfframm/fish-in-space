// Member sign-in (no public sign-up). Same-origin /api is proxied to PocketBase in production.

import PocketBase from '../../vendor/pocketbase.es.mjs';

type UserRec = { id: string; email?: string; name?: string; guest?: boolean };

const pbUrl = () => {
  try {
    return new URLSearchParams(location.search).get('pb') ?? JSON.parse(localStorage.getItem('seedfall.pb') ?? 'null') ?? location.origin;
  } catch {
    return typeof location === 'undefined' ? 'http://127.0.0.1:8090' : location.origin;
  }
};

export const pb = new PocketBase(pbUrl());
pb.autoCancellation(false);

const listeners = new Set<(u: UserRec | null) => void>();
export const onAuth = (fn: (u: UserRec | null) => void) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn(user()));

export let online = false;

export const user = () => (online && pb.authStore.isValid ? pb.authStore.record : null);
export const isMember = () => {
  const u = user();
  return !!u && !u.guest;
};

export async function startSession() {
  online = await fetch(`${pb.baseURL}/api/health`).then((r) => r.ok, () => false);
  if (!online) return emit(), null;
  try {
    if (pb.authStore.isValid) await pb.collection('users').authRefresh();
  } catch {
    pb.authStore.clear();
  }
  if (pb.authStore.record?.guest) pb.authStore.clear();
  emit();
  return user();
}

export async function signIn(email: string, password: string) {
  await pb.collection('users').authWithPassword(email, password);
  if (pb.authStore.record?.guest) {
    pb.authStore.clear();
    throw new Error('That account cannot sign in here.');
  }
  emit();
}

export async function signOut() {
  pb.authStore.clear();
  emit();
}
