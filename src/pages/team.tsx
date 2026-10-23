import { useEffect, useState } from "react";
import { gh, repoPath } from "@/lib/gh";
import { useData } from "@/lib/store";
import { ROLE_TO_PERMISSION, type Role, atLeast } from "@/lib/model";
import { errorText } from "@/lib/utils";
import { Avatar, ErrorNote, PageHeader } from "@/components/ui";

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including team and settings",
  manager: "Projects, sprints, releases and workflows",
  member: "Create and work on tasks, docs and files",
  viewer: "Read only",
};

interface Invite {
  id: number;
  invitee: { login: string; avatar_url: string } | null;
  permissions: string;
}

export function Team() {
  const { members, role, me, tasks, reload } = useData();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [login, setLogin] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const isAdmin = atLeast(role, "admin");
  const loadInvites = () => isAdmin && gh<Invite[]>(repoPath("/invitations")).then(setInvites, () => setInvites([]));
  useEffect(() => {
    void loadInvites();
  }, []);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await fn();
      if (ok) setNote(ok);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

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
              const user = login.trim().replace(/^@/, "");
              void run(async () => {
                await gh(repoPath(`/collaborators/${encodeURIComponent(user)}`), { method: "PUT", body: { permission: ROLE_TO_PERMISSION[newRole] } });
                setLogin("");
                await loadInvites();
                await reload();
              }, `Invited ${user}. They get an email from GitHub and appear here once they accept.`);
            }}
          >
            <h2 className="font-bold">Add a teammate</h2>
            <p className="text-sm text-slate-500">They need a free GitHub account. Enter their GitHub username.</p>
            <div className="flex flex-wrap gap-2">
              <input value={login} onChange={(e) => setLogin(e.target.value)} required className="input flex-1" placeholder="GitHub username" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="input w-36">
                {(["member", "manager", "viewer", "admin"] as Role[]).map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r}
                  </option>
                ))}
              </select>
              <button disabled={busy} className="btn-primary">
                Invite
              </button>
            </div>
          </form>
        )}
        <section className="card divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.login} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar login={m.login} url={m.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {m.login} {m.login === me.login && <span className="text-xs text-slate-500">(you)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {tasks.filter((t) => t.open && t.assignees.includes(m.login)).length} open tasks · {ROLE_HELP[m.role]}
                </p>
              </div>
              {isAdmin && m.login !== me.login ? (
                <>
                  <select
                    disabled={busy}
                    value={m.role}
                    onChange={(e) => run(async () => (await gh(repoPath(`/collaborators/${m.login}`), { method: "PUT", body: { permission: ROLE_TO_PERMISSION[e.target.value as Role] } }), await reload()), "Role updated.")}
                    className="input h-8 w-32 capitalize"
                  >
                    {(["admin", "manager", "member", "viewer"] as Role[]).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    disabled={busy}
                    onClick={() => confirm(`Remove ${m.login} from the workspace?`) && run(async () => (await gh(repoPath(`/collaborators/${m.login}`), { method: "DELETE" }), await reload()), `${m.login} was removed.`)}
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
        {isAdmin && invites.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Waiting to accept</h2>
            <div className="card divide-y divide-slate-100">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1 font-medium">{i.invitee?.login}</span>
                  <span className="text-xs text-slate-500">{i.permissions}</span>
                  <button disabled={busy} onClick={() => run(async () => (await gh(repoPath(`/invitations/${i.id}`), { method: "DELETE" }), await loadInvites()))} className="text-xs font-semibold text-red-600">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
