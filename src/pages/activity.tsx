import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { DATA_BRANCH, ghAll, repoPath } from "@/lib/gh";
import { useData } from "@/lib/store";
import type { Task } from "@/lib/model";
import { errorText } from "@/lib/utils";
import { Avatar, Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";

interface Event {
  id: string;
  type: string;
  actor: { login: string; avatar_url: string };
  created_at: string;
  payload: {
    action?: string;
    issue?: { number: number; title: string; pull_request?: unknown };
    comment?: { body: string };
    ref?: string;
    commits?: { message: string }[];
    pull_request?: { number: number; title: string; merged?: boolean };
  };
}

function describe(e: Event): { text: string; to?: string } | null {
  const p = e.payload;
  switch (e.type) {
    case "IssuesEvent":
      return { text: `${p.action === "opened" ? "created" : p.action} task "${p.issue!.title}"`, to: `/tasks/${p.issue!.number}` };
    case "IssueCommentEvent":
      return { text: `commented on "${p.issue!.title}": ${p.comment!.body.replace(/<!--[\s\S]*?-->/g, "").trim().slice(0, 120)}`, to: `/tasks/${p.issue!.number}` };
    case "PushEvent": {
      if (p.ref === `refs/heads/${DATA_BRANCH}`) return { text: (p.commits ?? []).map((c) => c.message.replace(/ \([^)]*\)$/, "")).join(" · ") || "updated workspace files" };
      return { text: `pushed ${p.commits?.length ?? 0} commits to ${p.ref?.replace("refs/heads/", "")}` };
    }
    case "PullRequestEvent":
      return { text: `${p.pull_request!.merged ? "merged" : p.action} pull request "${p.pull_request!.title}"` };
    case "MilestoneEvent":
      return { text: `${p.action} a sprint` };
    case "CreateEvent":
    case "DeleteEvent":
      return null;
  }
  return null;
}

// Who did it. Password logins share one GitHub key, so the person is read from the markers the app writes.
function actorOf(e: Event, tasks: Task[]): string | null {
  const p = e.payload;
  if (e.type === "IssueCommentEvent") return p.comment!.body.match(/<!-- by:([^ ]+) -->\s*$/)?.[1] ?? null;
  if (e.type === "IssuesEvent" && p.action === "opened") return tasks.find((t) => t.number === p.issue!.number)?.meta.by ?? null;
  if (e.type === "PushEvent") return p.commits?.map((c) => c.message.match(/ \(([^)]*)\)$/)?.[1]).find(Boolean) ?? null;
  return null;
}

export function Activity() {
  const { members, tasks } = useData();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [who, setWho] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    // GitHub keeps the last 90 days, up to 300 events.
    ghAll<Event>(repoPath("/events")).then(setEvents, (e) => (setError(errorText(e)), setEvents([])));
  }, []);
  const list = (events ?? [])
    .map((e) => {
      const login = actorOf(e, tasks) ?? e.actor.login;
      const m = members.find((x) => x.login === login);
      return { e, d: describe(e), login, m, name: m?.name || (m ? login : actorOf(e, tasks) ?? "Someone") };
    })
    .filter((x) => x.d && (!who || x.login === who));
  return (
    <>
      <PageHeader title="Activity">
        <select value={who} onChange={(e) => setWho(e.target.value)} className="input h-9 w-auto">
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.login} value={m.login}>
              {m.name || m.login}
            </option>
          ))}
        </select>
      </PageHeader>
      <main className="mx-auto w-full max-w-3xl p-6">
        <ErrorNote error={error} />
        {events === null ? (
          <Spinner />
        ) : list.length ? (
          <div className="card divide-y divide-slate-100">
            {list.map(({ e, d, login, m, name }) => (
              <div key={e.id} className="flex gap-3 px-4 py-3">
                <Avatar login={login} url={m?.avatar_url || undefined} name={name} size={28} />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{name}</span>{" "}
                  {d!.to ? (
                    <Link to={d!.to} className="hover:underline">
                      {d!.text}
                    </Link>
                  ) : (
                    d!.text
                  )}
                  <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No activity yet.</Empty>
        )}
      </main>
    </>
  );
}
