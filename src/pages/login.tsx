import { useState } from "react";
import { ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { OWNER, REPO, setToken } from "@/lib/gh";
import { normalizeId, unlock } from "@/lib/accounts";
import { useWs } from "@/lib/store";
import { errorText } from "@/lib/utils";
import { ErrorNote } from "@/components/ui";

const NEW_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo,notifications&description=Sneh%20Workspace";

export function Login() {
  const ws = useWs();
  const [mode, setMode] = useState<"password" | "key">("password");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [token, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const working = busy || ws.loading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-surface p-4">
      <div className="card w-full max-w-md p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="./favicon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Sneh Workspace</h1>
            <p className="text-sm text-slate-500">Sneh Gurukool's team workspace</p>
          </div>
        </div>

        {mode === "password" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              unlock(id, password)
                .then((t) => {
                  setToken(t, normalizeId(id));
                  return ws.reload();
                })
                .catch((err) => setError(errorText(err)))
                .finally(() => setBusy(false));
            }}
            className="flex flex-col gap-3"
          >
            <label className="label" htmlFor="user-id">
              User ID
            </label>
            <input id="user-id" value={id} onChange={(e) => setId(e.target.value)} className="input" autoComplete="username" autoCapitalize="none" required />
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input pr-10" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1.5 rounded p-1 text-slate-400 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <ErrorNote error={error || ws.error} />
            <button disabled={working || !id.trim() || !password} className="btn-primary justify-center">
              {working ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-xs text-slate-500">Your admin gives you your user ID and password. Forgot it? Ask them to reset it.</p>
          </form>
        ) : (
          <>
            <ol className="mb-5 flex flex-col gap-3 text-sm text-slate-700">
              <li>
                <span className="font-semibold">1.</span> Get your key from GitHub. The page opens with everything filled in, so just scroll down and click <b>Generate token</b>.
                <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="btn-secondary mt-2 w-full justify-center">
                  <KeyRound size={15} /> Get my key from GitHub <ExternalLink size={13} />
                </a>
              </li>
              <li>
                <span className="font-semibold">2.</span> Copy the key and paste it here. It stays only in this browser.
              </li>
            </ol>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setToken(token.trim());
                void ws.reload();
              }}
              className="flex flex-col gap-3"
            >
              <input value={token} onChange={(e) => setValue(e.target.value)} className="input font-mono" placeholder="ghp_…" autoComplete="off" required />
              <ErrorNote error={ws.error} />
              <button disabled={working || !token.trim()} className="btn-primary justify-center">
                {working ? "Signing in…" : "Sign in with key"}
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-500">
              For admins of the {OWNER}/{REPO} repository on GitHub.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "key" : "password");
            setError("");
          }}
          className="mt-5 text-xs font-semibold text-brand-600 underline"
        >
          {mode === "password" ? "Admin: sign in with a GitHub key" : "Sign in with user ID and password"}
        </button>
      </div>
    </main>
  );
}
