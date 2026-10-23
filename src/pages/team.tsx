import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Link2, Mail, MessageCircle, UserPlus } from "lucide-react";
import { getToken, readJson, updateJson } from "@/lib/gh";
import { newInviteCode, removeKey, removeLogin, saveInviteLock } from "@/lib/accounts";
import { useData } from "@/lib/store";
import { type Invite, type Role, atLeast, uid } from "@/lib/model";
import { format, subDays } from "date-fns";
import { BarChart3 } from "lucide-react";
import { cn, errorText, today } from "@/lib/utils";
import { Avatar, ErrorNote, Modal, PageHeader } from "@/components/ui";

const ROLE_HELP: Record<Role, string> = {
  admin: "Everything, including team and settings",
  manager: "Projects, sprints, releases and workflows",
  member: "Create and work on tasks, docs and files",
  viewer: "Read only",
};
const ROLES: Role[] = ["member", "manager", "viewer", "admin"];
// Who has how much on their plate, and the hours they logged this week.
function Workload() {
  const { members, tasks } = useData();
  const t0 = today();
  const weekAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const rows = members
    .map((m) => {
      const open = tasks.filter((t) => t.open && t.assignees.includes(m.login));
      const hours = tasks.flatMap((t) => t.meta.time ?? []).filter((e) => e.by === m.login && e.date >= weekAgo).reduce((n, e) => n + e.hours, 0);
      return {
        m,
        open: open.length,
        overdue: open.filter((t) => t.meta.due && t.meta.due < t0).length,
        points: open.reduce((n, t) => n + (t.meta.estimate ?? 0), 0),
        hours,
        done: tasks.filter((t) => !t.open && t.assignees.includes(m.login) && (t.closedAt ?? "") >= weekAgo).length,
      };
    })
    .sort((a, b) => b.open - a.open);
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <BarChart3 size={16} className="text-brand-500" />
        <h2 className="font-bold">Workload</h2>
        <span className="ml-auto text-xs text-slate-500">Last 7 days for done and hours</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-5 py-2">Person</th>
              <th className="px-2 py-2">Open tasks</th>
              <th className="px-2 py-2 text-right">Overdue</th>
              <th className="px-2 py-2 text-right">Points</th>
              <th className="px-2 py-2 text-right">Done</th>
              <th className="px-5 py-2 text-right">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.m.login}>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar login={r.m.login} url={r.m.avatar_url || undefined} name={r.m.name ?? undefined} size={26} />
                    <span className="font-medium">{r.m.name || r.m.login}</span>
                  </div>
                </td>
                <td className="w-1/3 px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full", r.open / max > 0.75 && r.open > 5 ? "bg-red-500" : "bg-brand-500")} style={{ width: `${(r.open / max) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right font-semibold">{r.open}</span>
                  </div>
                </td>
                <td className={cn("px-2 py-2.5 text-right font-semibold", r.overdue ? "text-red-600" : "text-slate-400")}>{r.overdue}</td>
                <td className="px-2 py-2.5 text-right text-slate-600">{r.points || "–"}</td>
                <td className="px-2 py-2.5 text-right text-green-700">{r.done}</td>
                <td className="px-5 py-2.5 text-right font-semibold">{r.hours ? `${+r.hours.toFixed(1)}h` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Shows a freshly made invite link once, with quick ways to send it.
function LinkModal({ link, onClose }: { link: { url: string; name: string; reset: boolean }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = link.reset
    ? `Hi ${link.name}, here is your link to set a new password for Sneh Workspace: ${link.url}`
    : `Hi ${link.name}, you're invited to Sneh Workspace. Open this link to choose your user ID and password: ${link.url}`;
  return (
    <Modal title={link.reset ? `Password link for ${link.name}` : `Invite link for ${link.name}`} onClose={onClose} wide>
      <p className="text-sm text-slate-600">Send this link to {link.name} privately. It works once, and you can only copy it now, so send it right away.</p>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <Link2 size={15} className="shrink-0 text-slate-400" />
        <input readOnly value={link.url} className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" onFocus={(e) => e.target.select()} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(link.url);
            setCopied(true);
          }}
          className="btn-primary"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn-secondary">
          <MessageCircle size={15} /> WhatsApp
        </a>
        <a href={`mailto:?subject=${encodeURIComponent("Your Sneh Workspace invite")}&body=${encodeURIComponent(message)}`} className="btn-secondary">
          <Mail size={15} /> Email
        </a>
      </div>
    </Modal>
  );
}

export function Team() {
  const { members, people, role, me, tasks, savePeople } = useData();
  const [name, setName] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [link, setLink] = useState<{ url: string; name: string; reset: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const isAdmin = atLeast(role, "admin");
  const hasLogin = new Set(people.map((p) => p.id));
  const nameOf = (l: string) => members.find((m) => m.login === l)?.name || l;

  const loadInvites = useCallback(() => {
    if (isAdmin) readJson<Invite[]>("invites.json", []).then(setInvites, () => setInvites([]));
  }, [isAdmin]);
  useEffect(loadInvites, [loadInvites]);

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

  // Locks the admin's key with a fresh secret code and records the pending invite.
  const makeInvite = async (who: string, r: Role, resetFor?: string) => {
    const code = newInviteCode();
    const key = await saveInviteLock(code, getToken());
    const invite: Invite = { id: uid(), key, name: who, role: r, by: me.login, at: new Date().toISOString(), ...(resetFor ? { resetFor } : {}) };
    const list = await updateJson<Invite[]>("invites.json", [], (l) => [...l.filter((i) => !(resetFor && i.resetFor === resetFor)), invite], resetFor ? `Password link for ${resetFor}` : `Invite ${who}`);
    setInvites(list);
    const base = window.location.href.split("#")[0];
    setLink({ url: `${base}#/join/${invite.id}.${code}`, name: who.split(" ")[0], reset: !!resetFor });
  };

  const cancelInvite = (i: Invite) =>
    run(async () => {
      await removeKey(i.key);
      setInvites(await updateJson<Invite[]>("invites.json", [], (l) => l.filter((x) => x.id !== i.id), `Cancel invite for ${i.name}`));
    }, "Invite cancelled. Its link no longer works.");

  const setRole = (pid: string, r: Role) => run(() => savePeople((list) => list.map((p) => (p.id === pid ? { ...p, role: r } : p)), "Change a role"), "Role updated.");
  const pending = invites.filter((i) => !i.resetFor);

  return (
    <>
      <PageHeader title="People & workload" crumb="Team" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <ErrorNote error={error} />
        {note && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{note}</p>}
        {isAdmin && (
          <form
            className="card flex flex-col gap-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const who = name.trim();
              void run(async () => {
                await makeInvite(who, newRole);
                setName("");
              });
            }}
          >
            <div className="flex items-center gap-2">
              <UserPlus size={18} className="text-brand-500" />
              <h2 className="font-bold">Invite a person</h2>
            </div>
            <p className="text-sm text-slate-500">Pick their name and role. You get a link to send them, and they choose their own user ID and password.</p>
            <div className="flex flex-wrap gap-2">
              <input name="invite-name" value={name} onChange={(e) => setName(e.target.value)} required className="input min-w-48 flex-1" placeholder="Full name" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="input w-auto">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}: {ROLE_HELP[r]}
                  </option>
                ))}
              </select>
              <button disabled={busy || !name.trim()} className="btn-primary">
                <Link2 size={15} /> {busy ? "Creating…" : "Create invite link"}
              </button>
            </div>
          </form>
        )}
        {isAdmin && pending.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 px-5 py-3 font-bold">Waiting to join</h2>
            <div className="divide-y divide-slate-100">
              {pending.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <Avatar login={i.id} name={i.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-xs text-slate-500">
                      Invited by {nameOf(i.by)} {formatDistanceToNow(new Date(i.at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="tag bg-slate-100 capitalize text-slate-600">{i.role}</span>
                  <button disabled={busy} onClick={() => cancelInvite(i)} className="text-xs font-semibold text-red-600">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
            <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">Lost a link? Cancel the invite and create a new one.</p>
          </section>
        )}
        <Workload />
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
                  <button disabled={busy} onClick={() => run(() => makeInvite(m.name || m.login, m.role, m.login))} className="text-xs font-semibold text-brand-600">
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
        <p className="text-xs text-slate-500">Logins and invites work through the GitHub key of the admin who made them. If that key is ever deleted or expires, invite people again from here.</p>
      </main>
      {link && <LinkModal link={link} onClose={() => setLink(null)} />}
    </>
  );
}
