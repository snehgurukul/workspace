import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AtSign, BellRing, CheckCheck, Clock, Inbox as InboxIcon, Megaphone, MessageSquare, UserPlus } from "lucide-react";
import { useData } from "@/lib/store";
import { type InboxItem, type InboxKind, useInbox } from "@/lib/inbox";
import { cn } from "@/lib/utils";
import { Avatar, Empty, PageHeader } from "@/components/ui";

const KIND: Record<InboxKind, { label: string; icon: typeof AtSign; color: string }> = {
  mention: { label: "Mentions", icon: AtSign, color: "bg-violet-100 text-violet-700" },
  assigned: { label: "Assigned", icon: UserPlus, color: "bg-blue-100 text-blue-700" },
  comment: { label: "Comments", icon: MessageSquare, color: "bg-green-100 text-green-700" },
  announcement: { label: "Announcements", icon: Megaphone, color: "bg-amber-100 text-amber-800" },
  due: { label: "Due soon", icon: Clock, color: "bg-red-100 text-red-700" },
};

function sentence(i: InboxItem, name: string) {
  switch (i.kind) {
    case "mention":
      return `${name} mentioned you`;
    case "assigned":
      return `${name} assigned you`;
    case "comment":
      return `${name} commented`;
    case "announcement":
      return `${name} posted an announcement`;
    case "due":
      return i.text ?? "Due soon";
  }
}

export function InboxPage() {
  const { members } = useData();
  const { items, isNew, markAllRead } = useInbox();
  const [filter, setFilter] = useState<InboxKind | "">("");
  // Highlight what was new when the page opened, then count it as read.
  const [fresh] = useState(() => new Set(items.filter(isNew).map((i) => i.id)));
  useEffect(() => {
    const t = setTimeout(markAllRead, 1500);
    return () => clearTimeout(t);
  }, [markAllRead]);
  const nameOf = (login?: string) => members.find((m) => m.login === login)?.name || login || "Someone";
  const shown = items.filter((i) => !filter || i.kind === filter);

  return (
    <>
      <PageHeader title="Inbox" crumb="Everything that needs your attention">
        <button onClick={markAllRead} className="btn-secondary">
          <CheckCheck size={15} /> Mark all read
        </button>
      </PageHeader>
      <main className="mx-auto w-full max-w-3xl p-6">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {([""] as (InboxKind | "")[]).concat(Object.keys(KIND) as InboxKind[]).map((k) => (
            <button
              key={k || "all"}
              onClick={() => setFilter(k)}
              className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", filter === k ? "bg-ink text-surface" : "bg-surface text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300")}
            >
              {k ? KIND[k].label : "All"} <span className="opacity-60">{k ? items.filter((i) => i.kind === k).length : items.length}</span>
            </button>
          ))}
        </div>
        {shown.length ? (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {shown.map((i) => {
              const K = KIND[i.kind];
              const body = (
                <>
                  <div className="relative shrink-0">
                    {i.by ? <Avatar login={i.by} name={nameOf(i.by)} size={36} /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700"><BellRing size={16} /></span>}
                    <span className={cn("absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-surface", K.color)}>
                      <K.icon size={11} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{sentence(i, nameOf(i.by))}</span>
                      <span className="text-slate-500">{i.kind === "announcement" ? ": " : " on "}</span>
                      <span className="font-medium">{i.title}</span>
                    </p>
                    {i.text && i.kind !== "due" && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{i.text.replace(/[*_`#>]+/g, "")}</p>}
                    <p className="mt-1 text-xs text-slate-400">{formatDistanceToNow(new Date(i.at), { addSuffix: true })}</p>
                  </div>
                  {fresh.has(i.id) && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" title="New" />}
                </>
              );
              const cls = cn("flex gap-3 px-4 py-3.5 transition hover:bg-slate-50", fresh.has(i.id) && "bg-brand-50/40");
              return i.task ? (
                <Link key={i.id} to={`/tasks/${i.task}`} className={cls}>
                  {body}
                </Link>
              ) : (
                <Link key={i.id} to="/" className={cls}>
                  {body}
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty icon={<InboxIcon size={36} />}>
            <p className="font-semibold text-slate-700">You're all caught up</p>
            <p>Mentions, new assignments, comments on your tasks and announcements appear here.</p>
          </Empty>
        )}
      </main>
    </>
  );
}
