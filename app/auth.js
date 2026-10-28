// Who is swiping. On first visit the app makes a guest account with random credentials kept in
// this browser and signs in with it, so swiping needs no sign-up; "Save account" later turns
// the guest into a real email/password account, keeping every swipe.
//
// When PocketBase isn't reachable the app keeps working offline: swipes stay in this browser,
// the personal model still trains, there is just no public model or admin.

import PocketBase from './vendor/pocketbase.es.mjs';

const GUEST_KEY = 'pixelgen.guest';
const store = {
  get: (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

// Same origin: the app server proxies /api and /_/ to PocketBase. ?pb= and pixelgen.pb still override.
const pbUrl = () => new URLSearchParams(location.search).get('pb') ?? store.get('pixelgen.pb') ?? location.origin;

export const pb = new PocketBase(pbUrl());
pb.autoCancellation(false);

const listeners = new Set();
/** Call `fn(user)` whenever who is signed in changes. */
export const onAuth = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn(user()));

export let online = false;

/** The signed-in user record, or null (offline). */
export const user = () => (online && pb.authStore.isValid ? pb.authStore.record : null);
export const isAdmin = () => user()?.role === 'admin';
export const isGuest = () => !!user()?.guest;
/** A stable id for whoever is swiping, offline too. */
export const who = () => user()?.id ?? 'local';

const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');

async function newGuest() {
  const tag = rand(4);
  const creds = { email: `guest-${rand(10)}@guest.pixelforge.local`, password: rand(24) };
  await pb.collection('users').create({ ...creds, passwordConfirm: creds.password, guest: true, name: `Guest ${tag}`, emailVisibility: false });
  store.set(GUEST_KEY, creds);
  return creds;
}

/** Sign in: the saved session, else this browser's guest, else a new guest. */
export async function startSession() {
  online = await fetch(`${pb.baseURL}/api/health`).then((r) => r.ok, () => false);
  if (!online) return emit(), null;
  try {
    if (pb.authStore.isValid) await pb.collection('users').authRefresh();
  } catch {
    pb.authStore.clear();
  }
  if (!pb.authStore.isValid) {
    let creds = store.get(GUEST_KEY);
    try {
      if (!creds) creds = await newGuest();
      await pb.collection('users').authWithPassword(creds.email, creds.password);
    } catch {
      // The saved guest is gone (database reset): start a new one.
      creds = await newGuest();
      await pb.collection('users').authWithPassword(creds.email, creds.password);
    }
  }
  emit();
  return user();
}

/** Turn this guest into a real account; all its swipes stay. */
export async function saveAccount({ name, email, password }) {
  const id = user().id;
  await pb.collection('users').update(id, { name, email, password, passwordConfirm: password, guest: false });
  await pb.collection('users').authWithPassword(email, password);
  store.set(GUEST_KEY, null);
  emit();
}

export async function signIn(email, password) {
  await pb.collection('users').authWithPassword(email, password);
  emit();
}

/** Sign out; a fresh guest takes over so swiping carries on. */
export async function signOut() {
  pb.authStore.clear();
  store.set(GUEST_KEY, null);
  await startSession();
}

// ---------- the account sheet ----------

/** Render the header chip and its sheet into `chip` / `sheet` elements. */
export function mountAccount(chip, sheet) {
  const draw = () => {
    const u = user();
    chip.textContent = !online ? 'offline' : u ? `${u.guest ? '👤 ' : ''}${u.name || u.email}${u.role === 'admin' ? ' ★' : ''}` : '…';
    chip.title = !online ? `No backend at ${pb.baseURL}: swipes stay in this browser` : 'Account';
    const form = (title, fields, submit, action) => `
      <form data-action="${action}" class="acct-form">
        <h3>${title}</h3>
        ${fields.map(([n, t, l, v = '']) => `<label>${l}<input name="${n}" type="${t}" value="${v}" required ${t === 'password' ? 'minlength="8"' : ''} autocomplete="${t === 'password' ? 'current-password' : n}"></label>`).join('')}
        <button class="btn primary" type="submit">${submit}</button>
        <p class="acct-err" role="alert"></p>
      </form>`;
    sheet.innerHTML = !online
      ? `<p>The backend isn't running, so swipes are kept in this browser only.<br>Start everything with <code>npm run app</code>.</p>`
      : `<p class="acct-who">${u?.guest ? 'You are swiping as a guest. Save the account to keep your taste on any device.' : `Signed in as <b>${u?.email}</b>.`}</p>
        ${u?.guest ? form('Save account', [['name', 'text', 'Name', u.name], ['email', 'email', 'Email'], ['password', 'password', 'Password']], 'Save', 'save') : ''}
        ${form('Sign in', [['email', 'email', 'Email'], ['password', 'password', 'Password']], 'Sign in', 'signin')}
        ${u && !u.guest ? '<button class="btn" type="button" data-action="signout">Sign out</button>' : ''}`;
  };
  chip.addEventListener('click', () => sheet.toggleAttribute('hidden'));
  sheet.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const v = Object.fromEntries(new FormData(f));
    try {
      if (f.dataset.action === 'save') await saveAccount(v);
      else await signIn(v.email, v.password);
      sheet.hidden = true;
    } catch (err) {
      f.querySelector('.acct-err').textContent = Object.values(err.response?.data ?? {})[0]?.message ?? err.message;
    }
  });
  sheet.addEventListener('click', async (e) => {
    if (e.target.dataset.action === 'signout') {
      await signOut();
      sheet.hidden = true;
    }
  });
  onAuth(draw);
  draw();
}
