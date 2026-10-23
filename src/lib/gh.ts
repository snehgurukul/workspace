// A small GitHub REST client. Every call runs in the browser with the signed-in person's own token,
// so GitHub itself decides what each person can see and change.

const API = "https://api.github.com";
const TOKEN_KEY = "sneh.token";

export const OWNER = import.meta.env.VITE_REPO_OWNER ?? "snehgurukul";
export const REPO = import.meta.env.VITE_REPO_NAME ?? "webapp";
// Wiki pages, files, whiteboards, QA and settings live on this branch, away from the app code.
export const DATA_BRANCH = "workspace-data";
const R = `/repos/${OWNER}/${REPO}`;

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};
export const setToken = (t: string) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private window: the token lasts for this tab only */
  }
};

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Init = { method?: string; body?: unknown; accept?: string };

async function request(path: string, init: Init = {}): Promise<Response> {
  const res = await fetch(path.startsWith("http") ? path : API + path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: init.accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = await res.json();
      message = j.message ?? message;
      if (j.errors?.[0]?.message) message += `: ${j.errors[0].message}`;
    } catch {
      /* not JSON */
    }
    if (res.status === 401) message = "Your GitHub sign-in has expired or the token is wrong. Sign in again.";
    throw new GitHubError(res.status, message);
  }
  return res;
}

export async function gh<T = unknown>(path: string, init: Init = {}): Promise<T> {
  const res = await request(path, init);
  return (res.status === 204 ? null : await res.json()) as T;
}

// Follows GitHub's Link headers to collect every page.
export async function ghAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path + (path.includes("?") ? "&" : "?") + "per_page=100";
  while (next) {
    const res = await request(next);
    out.push(...((await res.json()) as T[]));
    next = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return out;
}

export const repoPath = (p: string) => R + p;

// ---------------------------------------------------------------- text and base64

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

// ---------------------------------------------------------------- files on the data branch

export interface RepoFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export async function listDir(path: string): Promise<RepoFile[]> {
  try {
    return await gh<RepoFile[]>(`${R}/contents/${enc(path)}?ref=${DATA_BRANCH}`);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

export async function readText(path: string, ref = DATA_BRANCH): Promise<{ text: string; sha: string } | null> {
  try {
    const f = await gh<{ content: string; sha: string; encoding: string }>(`${R}/contents/${enc(path)}?ref=${ref}`);
    if (f.encoding === "base64") return { text: fromBase64(f.content), sha: f.sha };
    // Over 1 MB GitHub sends no content; fetch the raw text instead.
    const raw = await request(`${R}/contents/${enc(path)}?ref=${ref}`, { accept: "application/vnd.github.raw+json" });
    return { text: await raw.text(), sha: f.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export async function readBlob(path: string): Promise<Blob> {
  const res = await request(`${R}/contents/${enc(path)}?ref=${DATA_BRANCH}`, { accept: "application/vnd.github.raw+json" });
  return res.blob();
}

export async function writeBase64(path: string, content: string, message: string, sha?: string): Promise<string> {
  const res = await gh<{ content: { sha: string } }>(`${R}/contents/${enc(path)}`, {
    method: "PUT",
    body: { message, content, branch: DATA_BRANCH, ...(sha ? { sha } : {}) },
  });
  return res.content.sha;
}
export const writeText = (path: string, text: string, message: string, sha?: string) => writeBase64(path, toBase64(text), message, sha);

export async function deletePath(path: string, sha: string, message: string) {
  await gh(`${R}/contents/${enc(path)}`, { method: "DELETE", body: { message, sha, branch: DATA_BRANCH } });
}

// Reads a JSON file, applies a change and writes it back, retrying if someone else saved in between.
export async function updateJson<T>(path: string, fallback: T, change: (current: T) => T, message: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const file = await readText(path);
    const next = change(file ? (JSON.parse(file.text) as T) : structuredClone(fallback));
    try {
      await writeText(path, JSON.stringify(next, null, 2) + "\n", message, file?.sha);
      return next;
    } catch (e) {
      if (attempt < 3 && e instanceof GitHubError && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  const file = await readText(path);
  return file ? (JSON.parse(file.text) as T) : fallback;
}

export interface CommitInfo {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string; avatar_url: string } | null;
}
export const fileHistory = (path: string) => gh<CommitInfo[]>(`${R}/commits?sha=${DATA_BRANCH}&path=${encodeURIComponent(path)}&per_page=50`);

// Every path on the data branch in one call.
export async function dataTree(): Promise<{ path: string; type: "blob" | "tree"; sha: string; size?: number }[]> {
  try {
    const t = await gh<{ tree: { path: string; type: "blob" | "tree"; sha: string; size?: number }[] }>(`${R}/git/trees/${DATA_BRANCH}?recursive=1`);
    return t.tree;
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return [];
    throw e;
  }
}
