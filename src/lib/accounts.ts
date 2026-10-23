// Workspace logins (user ID + password) without a server.
// Each login is a GitHub key locked with that person's password (PBKDF2 + AES-GCM) and kept in accounts.json on the
// "accounts" branch of the public site repository, so the sign-in page can read it before anyone is signed in.
// Records are keyed by a hash of the user ID, so names never appear in the public file.
// Names and roles live in people.json on the private data branch.

import { gh, GitHubError, fromBase64, toBase64 } from "./gh";

export const SITE_OWNER = import.meta.env.VITE_SITE_OWNER ?? "snehgurukul";
export const SITE_REPO = import.meta.env.VITE_SITE_REPO ?? "workspace";
const ACCOUNTS_BRANCH = "accounts";
const ACCOUNTS_PATH = `/repos/${SITE_OWNER}/${SITE_REPO}/contents/accounts.json`;
const ITERATIONS = 600_000;
export const MIN_PASSWORD = 12;

interface Lock {
  salt: string;
  iv: string;
  data: string;
  iterations: number;
}
type Accounts = Record<string, Lock>;

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export const normalizeId = (id: string) => id.trim().toLowerCase();

async function idHash(id: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`sneh-workspace:${normalizeId(id)}`));
  return b64(digest).replace(/[+/=]/g, "").slice(0, 32);
}

async function keyFrom(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function lock(token: string, password: string): Promise<Lock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return { salt: b64(salt), iv: b64(iv), data: b64(data), iterations: ITERATIONS };
}

// Read without signing in. GitHub caches these files for a few minutes, so each read asks for a fresh copy,
// and a login that was just created is looked up again in the other copy before giving up.
async function readCopies(): Promise<Accounts[]> {
  const t = Date.now();
  const api = fetch(`https://api.github.com${ACCOUNTS_PATH}?ref=${ACCOUNTS_BRANCH}&t=${t}`, { headers: { Accept: "application/vnd.github.raw+json" }, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Accounts>) : null))
    .catch(() => null);
  const raw = fetch(`https://raw.githubusercontent.com/${SITE_OWNER}/${SITE_REPO}/${ACCOUNTS_BRANCH}/accounts.json?t=${t}`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Accounts>) : null))
    .catch(() => null);
  const [a, b] = await Promise.all([api, raw]);
  if (!a && !b) throw new Error("Could not reach GitHub. Check your internet connection and try again.");
  return [a, b].filter((x): x is Accounts => !!x);
}

export async function unlock(id: string, password: string): Promise<string> {
  const key = await idHash(id);
  const records = (await readCopies()).map((c) => c[key]).filter((r): r is Lock => !!r);
  for (const record of records) {
    try {
      const k = await keyFrom(password, bytes(record.salt), record.iterations);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(record.iv) }, k, bytes(record.data));
      return new TextDecoder().decode(plain);
    } catch {
      /* wrong password for this copy; try the next */
    }
  }
  throw new Error(records.length ? "That user ID or password is wrong." : "That user ID or password is wrong. If the login was created in the last few minutes, wait a minute and try again.");
}

// Read-modify-write of accounts.json with the signed-in person's key, retrying when someone else saved first.
async function change(fn: (a: Accounts) => Accounts, message: string) {
  for (let attempt = 0; ; attempt++) {
    let current: Accounts = {};
    let sha: string | undefined;
    try {
      const f = await gh<{ content: string; sha: string }>(`${ACCOUNTS_PATH}?ref=${ACCOUNTS_BRANCH}`);
      current = JSON.parse(fromBase64(f.content));
      sha = f.sha;
    } catch (e) {
      if (!(e instanceof GitHubError && e.status === 404)) throw e;
    }
    try {
      await gh(ACCOUNTS_PATH, { method: "PUT", body: { message, branch: ACCOUNTS_BRANCH, content: toBase64(JSON.stringify(fn(current), null, 1) + "\n"), ...(sha ? { sha } : {}) } });
      return;
    } catch (e) {
      if (attempt < 3 && e instanceof GitHubError && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}

export async function saveLogin(id: string, password: string, token: string) {
  if (password.length < MIN_PASSWORD) throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
  const record = await lock(token, password);
  const key = await idHash(id);
  await change((a) => ({ ...a, [key]: record }), "Update a workspace login");
}

export async function removeLogin(id: string) {
  const key = await idHash(id);
  await change((a) => {
    const { [key]: _, ...rest } = a;
    void _;
    return rest;
  }, "Remove a workspace login");
}
