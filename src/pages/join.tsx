import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useParams } from "react-router-dom";
import { readJson, setPageToken, setToken, updateJson } from "@/lib/gh";
import { MIN_PASSWORD, normalizeId, removeKey, saveLogin, unlockInvite } from "@/lib/accounts";
import { useWs } from "@/lib/store";
import type { Invite, Person } from "@/lib/model";
import { errorText } from "@/lib/utils";
import { ErrorNote, Spinner } from "@/components/ui";

const ID_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

// Opened from an invite link: #/join/<invite id>.<secret code>
export function Join() {
  const { link = "" } = useParams();
  const ws = useWs();
  const [inviteId, code] = [link.slice(0, link.indexOf(".")), link.slice(link.indexOf(".") + 1)];
  const [state, setState] = useState<{ token: string; invite: Invite } | null>(null);
  const [error, setError] = useState("");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    unlockInvite(code)
      .then(async (token) => {
        setPageToken(token);
        const invite = (await readJson<Invite[]>("invites.json", [])).find((i) => i.id === inviteId);
        if (!invite) throw new Error("This invite was cancelled or has already been used. Ask your admin for a new one.");
        setState({ token, invite });
        if (invite.resetFor) setId(invite.resetFor);
      })
      .catch((e) => setError(errorText(e)));
    return () => setPageToken("");
  }, [code, inviteId]);

  const submit = async () => {
    const { token, invite } = state!;
    const uid = normalizeId(id);
    if (pw !== again) throw new Error("The two passwords don't match.");
    if (pw.length < MIN_PASSWORD) throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
    if (!invite.resetFor) {
      if (!ID_RE.test(uid)) throw new Error("User IDs are 3 to 32 letters or numbers, and may use . _ or -");
      const people = await readJson<Person[]>("people.json", []);
      if (people.some((p) => p.id === uid)) throw new Error(`The user ID "${uid}" is taken. Try another.`);
    }
    await saveLogin(uid, pw, token);
    if (!invite.resetFor) await updateJson<Person[]>("people.json", [], (list) => [...list.filter((p) => p.id !== uid), { id: uid, name: invite.name, role: invite.role }], `${invite.name} joined`);
    await updateJson<Invite[]>("invites.json", [], (list) => list.filter((i) => i.id !== invite.id), invite.resetFor ? `Password reset for ${uid}` : `${invite.name} accepted the invite`);
    await removeKey(invite.key);
    setPageToken("");
    setToken(token, uid);
    window.location.hash = "#/";
    await ws.reload();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-surface p-4">
      <div className="card w-full max-w-md p-8 shadow-lift">
        <div className="mb-6 flex items-center gap-3">
          <img src="./favicon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Sneh Workspace</h1>
            <p className="text-sm text-slate-500">Sneh Gurukool's team workspace</p>
          </div>
        </div>
        {error && !state ? (
          <>
            <ErrorNote error={error} />
            <a href="#/" className="btn-secondary mt-4">
              <ArrowLeft size={15} /> Go to sign in
            </a>
          </>
        ) : !state ? (
          <Spinner label="Opening your invite…" />
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              submit()
                .catch((err) => setError(errorText(err)))
                .finally(() => setBusy(false));
            }}
          >
            {state.invite.resetFor ? (
              <p className="text-sm text-slate-600">
                Choose a new password for user ID <b>{state.invite.resetFor}</b>.
              </p>
            ) : (
              <>
                <p className="text-lg font-bold">Welcome, {state.invite.name.split(" ")[0]}!</p>
                <p className="text-sm text-slate-600">
                  You've been invited as <b className="capitalize">{state.invite.role}</b>. Choose the user ID and password you'll use to sign in.
                </p>
                <label className="label">
                  User ID
                  <input value={id} onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s/g, ""))} required className="input" placeholder="e.g. priya" autoCapitalize="none" autoComplete="username" />
                </label>
              </>
            )}
            <label className="label">
              Password
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={MIN_PASSWORD} className="input" placeholder={`At least ${MIN_PASSWORD} characters`} autoComplete="new-password" />
            </label>
            <label className="label">
              Type it again
              <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required className="input" autoComplete="new-password" />
            </label>
            <ErrorNote error={error} />
            <button disabled={busy} className="btn-primary justify-center">
              {busy ? "Setting up…" : state.invite.resetFor ? "Save password and sign in" : "Join the workspace"}
            </button>
            <p className="text-xs text-slate-500">Keep your password private. Next time, sign in at this same web address with your user ID and password.</p>
          </form>
        )}
      </div>
    </main>
  );
}
