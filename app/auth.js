// Who is signed in. The Forge (every generator) works with no account. Swipe, the aquarium,
// likes, breeding and home are for people this install has an account for: email and password,
// created by the owner. There is no public sign-up and no guest session.
//
// When PocketBase isn't reachable the Forge still runs. Member views stay closed.

import PocketBase from './vendor/pocketbase.es.mjs';

// Same origin: the app server proxies /api and /_/ to PocketBase. ?pb= and pixelgen.pb still override.
const pbUrl = () => {
  try {
    return new URLSearchParams(location.search).get('pb') ?? JSON.parse(localStorage.getItem('pixelgen.pb')) ?? location.origin;
  } catch {
    return location.origin;
  }
};

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
/** A real account. Guests left over from older sessions do not count. */
export const isMember = () => {
  const u = user();
  return !!u && !u.guest;
};
/** A stable id for whoever is swiping, or `local` when signed out. */
export const who = () => user()?.id ?? 'local';

/** Restore a saved session. Does not create an account. */
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

export async function signIn(email, password) {
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

let openSheet = () => {};
/** Open the sign-in sheet. Member views call this when nobody is signed in. */
export function openAccount() {
  openSheet();
}

// ---------- the account sheet ----------

/** Render the header chip and its sheet into `chip` / `sheet` elements. */
export function mountAccount(chip, sheet) {
  const setOpen = (open) => {
    sheet.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
  };
  openSheet = () => setOpen(true);
  const draw = () => {
    const u = isMember() ? user() : null;
    chip.textContent = u ? (u.name || u.email) : 'Sign in';
    chip.title = !online ? 'Sign-in needs the server. The Forge still works.' : u ? u.email : 'Sign in';
    sheet.innerHTML = !online
      ? `<p>The Forge works without an account. Sign-in needs the server — start it with <code>npm run app</code>.</p>`
      : u
        ? `<p class="acct-who">Signed in as <b></b>.</p><button class="btn" type="button" data-action="signout">Sign out</button>`
        : `<form data-action="signin" class="acct-form">
            <h3>Members</h3>
            <p>Swipe and the aquarium are for accounts on this server.</p>
            <label>Email<input name="email" type="email" required autocomplete="username"></label>
            <label>Password<input name="password" type="password" required minlength="8" autocomplete="current-password"></label>
            <button class="btn primary" type="submit">Sign in</button>
            <p class="acct-err" role="alert"></p>
          </form>`;
    const who = sheet.querySelector('.acct-who b');
    if (who) who.textContent = u.email;
  };
  chip.addEventListener('click', () => setOpen(sheet.hidden));
  sheet.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const v = Object.fromEntries(new FormData(f));
    try {
      await signIn(v.email, v.password);
      setOpen(false);
    } catch (err) {
      f.querySelector('.acct-err').textContent = Object.values(err.response?.data ?? {})[0]?.message ?? err.message;
    }
  });
  sheet.addEventListener('click', async (e) => {
    if (e.target.dataset.action === 'signout') {
      await signOut();
      setOpen(false);
    }
  });
  onAuth(draw);
  draw();
}
