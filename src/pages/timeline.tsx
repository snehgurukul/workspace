import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isWeekend, parseISO, startOfDay, subDays } from "date-fns";
import { GanttChartSquare, Rocket } from "lucide-react";
import { useData } from "@/lib/store";
import { taskKey } from "@/lib/model";
import { cn, today } from "@/lib/utils";
import { Empty, PageHeader } from "@/components/ui";

const ROW = 36;
const LEFT = 260;

interface Bar {
  id: string;
  label: string;
  sub: string;
  start: Date;
  end: Date;
  color: string;
  to: string;
  done?: boolean;
  late?: boolean;
  kind: "task" | "sprint";
}

// Gantt-style view of tasks (from their start date to their due date), sprints and release dates.
export function Timeline() {
  const { tasks, sprints, config } = useData();
  const [params, setParams] = useSearchParams();
  const project = params.get("project") ?? "";
  const [zoom, setZoom] = useState<"day" | "week">("day");
  const [showDone, setShowDone] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const dayW = zoom === "day" ? 32 : 12;
  const colorOf = (key: string) => config.projects.find((p) => p.key === key)?.color ?? "#94a3b8";
  const t0 = startOfDay(new Date());

  const { bars, unscheduled, releases } = useMemo(() => {
    const inProject = (k: string) => !project || k === project;
    const bars: Bar[] = [];
    for (const s of sprints) {
      if (!inProject(s.project) || !s.end) continue;
      bars.push({ id: `s${s.number}`, label: s.name, sub: `${s.project} sprint`, start: parseISO(s.start || s.end), end: parseISO(s.end), color: colorOf(s.project), to: `/sprints?project=${s.project}`, done: !s.open, kind: "sprint" });
    }
    const list = tasks.filter((t) => inProject(t.project) && (showDone || t.open));
    for (const t of list) {
      if (!t.meta.due && !t.meta.start) continue;
      const end = parseISO(t.meta.due ?? t.meta.start!);
      let start = t.meta.start ? parseISO(t.meta.start) : end;
      if (start > end) start = end;
      bars.push({ id: `t${t.number}`, label: t.title, sub: taskKey(t.project, t.number), start, end, color: colorOf(t.project), to: `/tasks/${t.number}`, done: !t.open, late: t.open && !!t.meta.due && t.meta.due < today(), kind: "task" });
    }
    bars.sort((a, b) => (a.kind === b.kind ? a.start.getTime() - b.start.getTime() : a.kind === "sprint" ? -1 : 1));
    return {
      bars,
      unscheduled: list.filter((t) => t.open && !t.meta.due && !t.meta.start),
      releases: config.releases.filter((r) => inProject(r.project) && r.date),
    };
  }, [tasks, sprints, config, project, showDone]);

  const dates = [...bars.flatMap((b) => [b.start, b.end]), ...releases.map((r) => parseISO(r.date)), t0];
  const from = subDays(new Date(Math.min(...dates.map((d) => d.getTime()))), 7);
  const to = addDays(new Date(Math.max(...dates.map((d) => d.getTime()), addDays(t0, 30).getTime())), 7);
  const days = eachDayOfInterval({ start: from, end: to });
  const x = (d: Date) => differenceInCalendarDays(d, from) * dayW;
  const width = days.length * dayW;

  // Start scrolled so today is near the left edge.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(t0) - 7 * dayW);
  }, [zoom, project]);

  const months = days.filter((d, i) => i === 0 || d.getDate() === 1);

  return (
    <>
      <PageHeader title="Timeline" crumb="Plan">
        <select value={project} onChange={(e) => setParams(e.target.value ? { project: e.target.value } : {})} className="input h-9 w-auto">
          <option value="">All projects</option>
          {config.projects
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
        </select>
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {(["day", "week"] as const).map((z) => (
            <button key={z} onClick={() => setZoom(z)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold capitalize", zoom === z ? "bg-surface text-ink shadow-soft" : "text-slate-500")}>
              {z === "day" ? "Days" : "Weeks"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
        </label>
      </PageHeader>
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        {bars.length || releases.length ? (
          <div className="card flex min-h-0 overflow-hidden">
            <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
              <div style={{ width: width + LEFT }} className="relative">
                {/* Header */}
                <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-surface">
                  <div className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400" style={{ width: LEFT }}>
                    Item
                  </div>
                  <div className="relative h-12" style={{ width }}>
                    {months.map((m) => (
                      <span key={m.toISOString()} className="absolute top-1 whitespace-nowrap border-l border-slate-200 pl-1.5 text-xs font-bold" style={{ left: x(m) }}>
                        {format(m, "MMMM yyyy")}
                      </span>
                    ))}
                    {days.map((d) =>
                      zoom === "day" || d.getDay() === 1 ? (
                        <span key={d.toISOString()} className={cn("absolute bottom-1 text-center text-[10px]", differenceInCalendarDays(d, t0) === 0 ? "font-bold text-brand-600" : "text-slate-400")} style={{ left: x(d), width: zoom === "day" ? dayW : dayW * 7 }}>
                          {zoom === "day" ? format(d, "d") : format(d, "d MMM")}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
                {/* Background: weekends and today */}
                <div className="pointer-events-none absolute bottom-0 top-12" style={{ left: LEFT, width }}>
                  {zoom === "day" && days.map((d) => (isWeekend(d) ? <div key={d.toISOString()} className="absolute bottom-0 top-0 bg-slate-100/60" style={{ left: x(d), width: dayW }} /> : null))}
                  <div className="absolute bottom-0 top-0 z-10 w-0.5 bg-brand-500" style={{ left: x(t0) + dayW / 2 }}>
                    <span className="absolute -left-5 top-0 rounded bg-brand-500 px-1 text-[9px] font-bold text-white">TODAY</span>
                  </div>
                </div>
                {/* Releases lane */}
                {releases.length > 0 && (
                  <div className="relative flex border-b border-slate-100" style={{ height: ROW }}>
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-surface px-4 text-sm font-semibold" style={{ width: LEFT }}>
                      <Rocket size={14} className="text-slate-400" /> Releases
                    </div>
                    <div className="relative" style={{ width }}>
                      {releases.map((r) => (
                        <Link key={r.id} to="/releases" title={`${r.name} · ${format(parseISO(r.date), "d MMM")}`} className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1" style={{ left: x(parseISO(r.date)) + dayW / 2 - 6 }}>
                          <span className="h-3 w-3 rotate-45 rounded-sm" style={{ background: colorOf(r.project) }} />
                          <span className="whitespace-nowrap text-[11px] font-semibold">{r.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {bars.map((b) => {
                  const left = x(b.start);
                  const w = Math.max(dayW, x(b.end) - left + dayW);
                  return (
                    <div key={b.id} className="group relative flex border-b border-slate-100 hover:bg-slate-50/70" style={{ height: ROW }}>
                      <Link to={b.to} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-surface px-4 group-hover:bg-slate-50" style={{ width: LEFT }}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />
                        <span className={cn("min-w-0 flex-1 truncate text-sm", b.kind === "sprint" ? "font-bold" : "font-medium", b.done && "text-slate-400 line-through")}>{b.label}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{b.sub}</span>
                      </Link>
                      <div className="relative" style={{ width }}>
                        <Link
                          to={b.to}
                          title={`${b.label}: ${format(b.start, "d MMM")} – ${format(b.end, "d MMM")}`}
                          className={cn("absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110", b.kind === "sprint" && "h-4 rounded-full opacity-70", b.done && "opacity-40", b.late && "ring-2 ring-red-500 ring-offset-1 ring-offset-surface")}
                          style={{ left, width: w, background: b.color }}
                        >
                          {b.kind === "task" && w > 60 && <span className="truncate">{b.label}</span>}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <Empty icon={<GanttChartSquare size={36} />}>
            <p className="font-semibold text-slate-700">Nothing scheduled yet</p>
            <p>Give tasks a start date and a due date on the task page and they show up here as bars.</p>
          </Empty>
        )}
        {unscheduled.length > 0 && (
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">{unscheduled.length} open tasks have no dates</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {unscheduled.slice(0, 40).map((t) => (
                <Link key={t.number} to={`/tasks/${t.number}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">
                  {taskKey(t.project, t.number)} {t.title}
                </Link>
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
