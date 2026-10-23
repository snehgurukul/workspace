import { useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, formatDistanceToNow, subDays } from "date-fns";
import { AlarmClock, Bug, CalendarClock, CheckCircle2, ListTodo, Megaphone, Pin, Trash2 } from "lucide-react";
import { useData } from "@/lib/store";
import { atLeast, taskKey, uid } from "@/lib/model";
import { cn, errorText, today } from "@/lib/utils";
import { Avatar, Empty, ErrorNote, Markdown, Modal, Progress } from "@/components/ui";
import { NewTaskButton, TaskRow } from "@/components/task-bits";

function Stat({ label, value, icon: Icon, to, tone }: { label: string; value: number; icon: typeof Bug; to: string; tone: string }) {
  return (
    <Link to={to} className="card card-hover flex items-center gap-3 p-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{label}</p>
      </div>
    </Link>
  );
}

function Announcements() {
  const { announcements, members, me, role, saveAnnouncements } = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canPost = atLeast(role, "manager");
  const list = [...announcements].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at)).slice(0, 5);
  const nameOf = (l: string) => members.find((m) => m.login === l)?.name || l;
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    return fn()
      .then(() => true)
      .catch((e) => (setError(errorText(e)), false))
      .finally(() => setBusy(false));
  };
  if (!list.length && !canPost) return null;
  return (
    <section>
      <div className="section-title">
        <Megaphone size={14} /> Announcements
        {canPost && (
          <button onClick={() => setOpen(true)} className="ml-auto text-xs font-semibold normal-case tracking-normal text-brand-600 hover:underline">
            + Post
          </button>
        )}
      </div>
      <ErrorNote error={error} />
      {list.length ? (
        <div className="flex flex-col gap-3">
          {list.map((a) => (
            <article key={a.id} className={cn("card p-4", a.pinned && "border-amber-300 bg-amber-50/40")}>
              <div className="flex items-start gap-3">
                <Avatar login={a.by} name={nameOf(a.by)} size={32} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">
                    {a.pinned && <Pin size={13} className="mr-1 inline text-amber-600" />}
                    {a.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {nameOf(a.by)} · {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                  </p>
                  {a.body && <Markdown source={a.body} className="mt-2" />}
                </div>
                {(a.by === me.login || atLeast(role, "admin")) && (
                  <div className="flex gap-1">
                    <button disabled={busy} onClick={() => run(() => saveAnnouncements((l) => l.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)), `${a.pinned ? "Unpin" : "Pin"} announcement`))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-ink" title={a.pinned ? "Unpin" : "Pin to top"}>
                      <Pin size={14} />
                    </button>
                    <button disabled={busy} onClick={() => confirm("Delete this announcement?") && run(() => saveAnnouncements((l) => l.filter((x) => x.id !== a.id), "Delete announcement"))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>Share news with the whole team. Everyone sees it here and in their inbox.</Empty>
      )}
      {open && (
        <Modal title="New announcement" onClose={() => setOpen(false)} wide>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveAnnouncements((l) => [{ id: uid(), title: title.trim(), body: body.trim(), by: me.login, at: new Date().toISOString() }, ...l], `Announce: ${title.trim()}`)).then((ok) => {
                if (ok) {
                  setOpen(false);
                  setTitle("");
                  setBody("");
                }
              });
            }}
          >
            <label className="label">
              Title
              <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="input" placeholder="e.g. Staff meeting moved to Friday" />
            </label>
            <label className="label">
              Message
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="input" placeholder="Details (optional). You can use **bold**, lists and links." />
            </label>
            <ErrorNote error={error} />
            <button disabled={busy || !title.trim()} className="btn-primary self-start">
              {busy ? "Posting…" : "Post announcement"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

// Tasks finished each day over the last two weeks.
function DoneChart() {
  const { tasks } = useData();
  const days = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), "yyyy-MM-dd"));
  const counts = days.map((d) => tasks.filter((t) => !t.open && t.closedAt?.slice(0, 10) === d).length);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold">Team progress</h2>
        <span className="text-xs text-slate-500">{total} done in 2 weeks</span>
      </div>
      <div className="mt-4 flex h-28 items-end gap-1.5">
        {counts.map((n, i) => (
          <div key={days[i]} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className={cn("rounded-t-md transition-all", n ? "bg-brand-500 group-hover:bg-brand-600" : "bg-slate-100")} style={{ height: `${n ? Math.max(8, (n / max) * 100) : 4}%` }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-surface group-hover:block">
              {n} on {format(new Date(days[i]), "d MMM")}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
        <span>{format(new Date(days[0]), "d MMM")}</span>
        <span>Today</span>
      </div>
    </section>
  );
}

export function Home() {
  const { me, tasks, config, sprints } = useData();
  const t0 = today();
  const week = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const mine = tasks.filter((t) => t.open && t.assignees.includes(me.login));
  const overdue = mine.filter((t) => t.meta.due && t.meta.due < t0);
  const thisWeek = mine.filter((t) => t.meta.due && t.meta.due >= t0 && t.meta.due <= week);
  const dueSoon = tasks.filter((t) => t.open && t.meta.due && t.meta.due >= t0).sort((a, b) => a.meta.due!.localeCompare(b.meta.due!)).slice(0, 6);
  const openBugs = tasks.filter((t) => t.open && t.type === "bug");
  const doneWeek = tasks.filter((t) => !t.open && t.closedAt && t.closedAt.slice(0, 10) >= format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const active = sprints.filter((s) => s.open);
  const hour = new Date().getHours();
  const first = me.name?.split(" ")[0] || me.login;
  const summary = mine.length ? `You have ${mine.length} open task${mine.length === 1 ? "" : "s"}${overdue.length ? `, ${overdue.length} overdue` : ""}${thisWeek.length ? ` and ${thisWeek.length} due this week` : ""}.` : "Nothing is assigned to you right now.";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-orange-500 to-amber-400 p-6 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">{format(new Date(), "EEEE d MMMM")}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {first}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-white/90">{summary}</p>
        <div className="mt-4 flex flex-wrap gap-2 [&_.btn-primary]:bg-white [&_.btn-primary]:text-[#c2410c] [&_.btn-primary]:shadow-none [&_.btn-primary:hover]:bg-orange-50">
          <NewTaskButton />
          <Link to="/my-tasks" className="btn border border-white/40 text-white hover:bg-white/10">
            Open my tasks
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Assigned to me" value={mine.length} icon={ListTodo} to="/my-tasks" tone="bg-blue-100 text-blue-700" />
        <Stat label="Overdue" value={overdue.length} icon={AlarmClock} to="/my-tasks" tone="bg-red-100 text-red-700" />
        <Stat label="Due this week" value={thisWeek.length} icon={CalendarClock} to="/calendar" tone="bg-amber-100 text-amber-800" />
        <Stat label="Open bugs" value={openBugs.length} icon={Bug} to="/bugs" tone="bg-violet-100 text-violet-700" />
        <Stat label="Done this week" value={doneWeek.length} icon={CheckCircle2} to="/activity" tone="bg-green-100 text-green-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section>
            <div className="section-title">
              <ListTodo size={14} /> My open tasks
              {mine.length > 8 && (
                <Link to="/my-tasks" className="ml-auto text-xs font-semibold normal-case tracking-normal text-brand-600 hover:underline">
                  See all {mine.length}
                </Link>
              )}
            </div>
            {mine.length ? (
              <div className="card overflow-hidden">
                {mine.slice(0, 8).map((t) => (
                  <TaskRow key={t.number} task={t} showProject />
                ))}
              </div>
            ) : (
              <Empty icon={<CheckCircle2 size={32} />}>Nothing assigned to you. Nice!</Empty>
            )}
          </section>
          <Announcements />
          <section>
            <div className="section-title">Projects</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.projects
                .filter((p) => !p.archived)
                .map((p) => {
                  const pt = tasks.filter((t) => t.project === p.key);
                  return (
                    <Link key={p.key} to={`/projects/${p.key}/board`} className="card card-hover p-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold text-white" style={{ background: p.color }}>
                          {p.key.slice(0, 2)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="text-xs text-slate-500">{pt.filter((t) => t.open).length} open tasks</p>
                        </div>
                      </div>
                      <Progress className="mt-3" done={pt.filter((t) => !t.open).length} total={pt.length} />
                    </Link>
                  );
                })}
              {!config.projects.length && <Empty>No projects yet. Create one under Projects.</Empty>}
            </div>
          </section>
        </div>
        <div className="flex flex-col gap-6">
          <DoneChart />
          <section>
            <div className="section-title">
              <CalendarClock size={14} /> Coming up
            </div>
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {dueSoon.map((t) => {
                const d = new Date(t.meta.due!);
                return (
                  <Link key={t.number} to={`/tasks/${t.number}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50">
                    <span className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-slate-100 py-1 leading-none">
                      <span className="text-[9px] font-bold uppercase text-brand-600">{format(d, "MMM")}</span>
                      <span className="text-base font-extrabold">{format(d, "d")}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-slate-500">
                        {taskKey(t.project, t.number)} · {format(d, "EEEE")}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {!dueSoon.length && <p className="p-4 text-sm text-slate-500">No upcoming due dates.</p>}
            </div>
          </section>
          {active.length > 0 && (
            <section>
              <div className="section-title">Sprints in progress</div>
              <div className="flex flex-col gap-2">
                {active.map((s) => {
                  const st = tasks.filter((t) => t.milestone === s.number);
                  return (
                    <Link key={s.number} to={`/sprints?project=${s.project}`} className="card card-hover p-3">
                      <p className="text-sm font-semibold">
                        {s.project} · {s.name}
                      </p>
                      {s.end && <p className="text-xs text-slate-500">ends {format(new Date(s.end), "d MMM")}</p>}
                      <Progress className="mt-2" done={st.filter((t) => !t.open).length} total={st.length} />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
