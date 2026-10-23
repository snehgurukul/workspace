import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { DATA_BRANCH, ghAll, repoPath } from "@/lib/gh";
import { useData } from "@/lib/store";
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
      return { text: `commented on "${p.issue!.title}": ${p.comment!.body.slice(0, 120)}`, to: `/tasks/${p.issue!.number}` };
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

export function Activity() {
  const { members } = useData();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [who, setWho] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    // GitHub keeps the last 90 days, up to 300 events.
    ghAll<Event>(repoPath("/events")).then(setEvents, (e) => (setError(errorText(e)), setEvents([])));
  }, []);
  const list = (events ?? []).filter((e) => !who || e.actor.login === who).map((e) => ({ e, d: describe(e) })).filter((x) => x.d);
  return (
    <>
      <PageHeader title="Activity">
        <select value={who} onChange={(e) => setWho(e.target.value)} className="input h-9 w-auto">
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.login}>{m.login}</option>
          ))}
        </select>
      </PageHeader>
      <main className="mx-auto w-full max-w-3xl p-6">
        <ErrorNote error={error} />
        {events === null ? (
          <Spinner />
        ) : list.length ? (
          <div className="card divide-y divide-slate-100">
            {list.map(({ e, d }) => (
              <div key={e.id} className="flex gap-3 px-4 py-3">
                <Avatar login={e.actor.login} url={e.actor.avatar_url} size={28} />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{e.actor.login}</span>{" "}
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
