import { useState } from "react";
import { getToken } from "@/lib/gh";
import { MIN_PASSWORD, isTakenOnSite, normalizeId, removeLogin, saveLogin } from "@/lib/accounts";
import { useData } from "@/lib/store";
import { type Role, atLeast } from "@/lib/model";
import { errorText } from "@/lib/utils";
import { Avatar, ErrorNote, Modal, PageHeader } from "@/components/ui";

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including team and settings",
  manager: "Projects, sprints, releases and workflows",
  member: "Create and work on tasks, docs and files",
  viewer: "Read only",
};
const ROLES: Role[] = ["member", "manager", "viewer", "admin"];
const ID_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono" placeholder={`Password (at least ${MIN_PASSWORD} characters)`} autoComplete="new-password" minLength={MIN_PASSWORD} required />
      {value && value.length < MIN_PASSWORD && <span className="text-xs text-amber-700">{MIN_PASSWORD - value.length} more characters needed</span>}
    </div>
  );
}

export function Team() {
  const { members, people, role, me, tasks, savePeople } = useData();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [reset, setReset] = useState<{ id: string; name: string } | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const isAdmin = atLeast(role, "admin");
  const hasLogin = new Set(people.map((p) => p.id));

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn();
      if (ok) setNote(ok);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setRole = (pid: string, r: Role) => run(() => savePeople((list) => list.map((p) => (p.id === pid ? { ...p, role: r } : p)), "Change a role"), "Role updated.");

  return (
    <>
      <PageHeader title="Team" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <ErrorNote error={error} />
        {note && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{note}</p>}
        {isAdmin && (
          <form
            className="card flex flex-col gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const uid = normalizeId(id);
              const display = name.trim() || uid;
              void run(async () => {
                if (!ID_RE.test(uid)) throw new Error("User IDs are 3 to 32 letters or numbers, and may use . _ or -");
                if (people.some((p) => p.id === uid) || (await isTakenOnSite(uid))) throw new Error(`The user ID "${uid}" is already taken.`);
                if (password.length < MIN_PASSWORD) throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
                await saveLogin(uid, password, getToken());
                await savePeople((list) => [...list.filter((p) => p.id !== uid), { id: uid, name: display, role: newRole }], `Add ${display}`);
                setName("");
                setId("");
                setPassword("");
              }, `${display} can now sign in with user ID "${uid}" and the password you chose. Send both to them privately.`);
            }}
          >
            <h2 className="font-bold">Add a person</h2>
            <p className="text-sm text-slate-500">Choose a user ID and password for them. They sign in at this same web address with just those two.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} required className="input" placeholder="Full name" />
              <input value={id} onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s/g, ""))} required className="input" placeholder="User ID, e.g. priya" autoCapitalize="none" autoComplete="off" />
              <PasswordInput value={password} onChange={setPassword} />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="input">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}: {ROLE_HELP[r]}
                  </option>
                ))}
              </select>
            </div>
            <button disabled={busy} className="btn-primary self-start">
              {busy ? "Saving…" : "Create login"}
            </button>
          </form>
        )}
        <section className="card divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.login} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar login={m.login} url={m.avatar_url || undefined} name={m.name ?? undefined} size={32} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {m.name || m.login} {m.login === me.login && <span className="text-xs text-slate-500">(you)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {hasLogin.has(m.login) ? `User ID: ${m.login}` : "Signed in with a GitHub key"} · {tasks.filter((t) => t.open && t.assignees.includes(m.login)).length} open tasks
                </p>
              </div>
              {isAdmin && hasLogin.has(m.login) && m.login !== me.login ? (
                <>
                  <select disabled={busy} value={m.role} onChange={(e) => void setRole(m.login, e.target.value as Role)} className="input h-8 w-32 capitalize">
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <button disabled={busy} onClick={() => setReset({ id: m.login, name: m.name || m.login })} className="text-xs font-semibold text-brand-600">
                    Reset password
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      confirm(`Remove ${m.name || m.login}? They will no longer be able to sign in.`) &&
                      run(async () => {
                        await removeLogin(m.login);
                        await savePeople((list) => list.filter((p) => p.id !== m.login), `Remove ${m.name || m.login}`);
                      }, `${m.name || m.login} was removed.`)
                    }
                    className="text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="tag bg-slate-100 capitalize text-slate-600">{m.role}</span>
              )}
            </div>
          ))}
        </section>
        <p className="text-xs text-slate-500">
          Logins work through the GitHub key of the admin who created them. If that key is ever deleted or expires, create the logins again from here.
        </p>
      </main>
      {reset && (
        <Modal title={`New password for ${reset.name}`} onClose={() => setReset(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveLogin(reset.id, resetPw, getToken()), `${reset.name}'s password was changed. Send the new one to them privately.`).then((ok) => {
                if (ok) {
                  setReset(null);
                  setResetPw("");
                }
              });
            }}
          >
            <PasswordInput value={resetPw} onChange={setResetPw} />
            <button disabled={busy} className="btn-primary self-start">
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
