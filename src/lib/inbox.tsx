import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ghAll, repoPath } from "./gh";
import { useData } from "./store";
import { today } from "./utils";

// The in-app inbox: mentions, new assignments, comments on your tasks, team announcements and due-date reminders.
// Built from the workspace data, so it works for everyone, including people without a GitHub account.

export type InboxKind = "mention" | "assigned" | "comment" | "announcement" | "due";

export interface InboxItem {
  id: string;
  kind: InboxKind;
  at: string;
  by?: string;
  task?: number;
  title: string;
  text?: string;
}

interface GhComment {
  id: number;
  body: string;
  created_at: string;
  issue_url: string;
  user: { login: string };
}

const BY_RE = /\n*<!-- by:([^ ]+) -->\s*$/;
const seenKey = (login: string) => `sneh.inbox.seen.${login}`;

function readSeen(login: string) {
  try {
    return localStorage.getItem(seenKey(login)) ?? "";
  } catch {
    return "";
  }
}

function useInboxState() {
  const { me, tasks, announcements } = useData();
  const [comments, setComments] = useState<GhComment[]>([]);
  const [seen, setSeenState] = useState(() => readSeen(me.login));

  const load = useCallback(() => {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    return ghAll<GhComment>(repoPath(`/issues/comments?sort=created&direction=desc&since=${since}`), 2).then(setComments, () => {});
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const items = useMemo(() => {
    const out: InboxItem[] = [];
    const byNumber = new Map(tasks.map((t) => [t.number, t]));
    const mention = new RegExp(`(^|[^\\w])@${me.login.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    for (const c of comments) {
      const by = c.body.match(BY_RE)?.[1] ?? c.user.login;
      if (by === me.login) continue;
      const number = Number(c.issue_url.split("/").pop());
      const task = byNumber.get(number);
      if (!task) continue;
      const text = c.body.replace(/<!--[\s\S]*?-->/g, "").trim();
      if (mention.test(text)) out.push({ id: `m${c.id}`, kind: "mention", at: c.created_at, by, task: number, title: task.title, text });
      else if (task.assignees.includes(me.login) || task.author === me.login) out.push({ id: `c${c.id}`, kind: "comment", at: c.created_at, by, task: number, title: task.title, text });
    }
    for (const t of tasks) {
      const a = t.meta.assigned?.[me.login];
      if (a && a.by !== me.login && t.assignees.includes(me.login)) out.push({ id: `a${t.number}-${a.at}`, kind: "assigned", at: a.at, by: a.by, task: t.number, title: t.title });
      if (t.open && t.meta.due && t.assignees.includes(me.login)) {
        const days = Math.round((Date.parse(t.meta.due) - Date.parse(today())) / 86400_000);
        if (days <= 1) out.push({ id: `d${t.number}-${t.meta.due}`, kind: "due", at: `${t.meta.due}T00:00:00Z`, task: t.number, title: t.title, text: days < 0 ? `Overdue by ${-days} day${days === -1 ? "" : "s"}` : days === 0 ? "Due today" : "Due tomorrow" });
      }
    }
    for (const n of announcements) if (n.by !== me.login) out.push({ id: `n${n.id}`, kind: "announcement", at: n.at, by: n.by, title: n.title, text: n.body });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [comments, tasks, announcements, me.login]);

  const isNew = useCallback((i: InboxItem) => i.kind !== "due" && i.at > seen, [seen]);
  const unread = items.filter(isNew).length;
  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(seenKey(me.login), now);
    } catch {
      /* keep for this visit only */
    }
    setSeenState(now);
  }, [me.login]);

  return { items, unread, isNew, markAllRead, reload: load };
}

const Ctx = createContext<ReturnType<typeof useInboxState> | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const inbox = useInboxState();
  return <Ctx.Provider value={inbox}>{children}</Ctx.Provider>;
}

export const useInbox = () => useContext(Ctx)!;
