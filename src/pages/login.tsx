import { useState } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import { OWNER, REPO, setToken } from "@/lib/gh";
import { useWs } from "@/lib/store";
import { ErrorNote } from "@/components/ui";

const NEW_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo,notifications&description=Sneh%20Workspace";

export function Login() {
  const ws = useWs();
  const [token, setValue] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="card w-full max-w-md p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="./favicon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Sneh Workspace</h1>
            <p className="text-sm text-slate-500">Sneh Gurukool's team workspace</p>
          </div>
        </div>
        <ol className="mb-5 flex flex-col gap-3 text-sm text-slate-700">
          <li>
            <span className="font-semibold">1.</span> Get your sign-in key from GitHub. The page opens with everything filled in, so just scroll down and click <b>Generate token</b>.
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
          <button disabled={ws.loading || !token.trim()} className="btn-primary justify-center">
            {ws.loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-xs text-slate-500">
          You need to be a member of the {OWNER}/{REPO} repository on GitHub. Ask an admin to add you if sign-in says you don't have access.
        </p>
      </div>
    </main>
  );
}
