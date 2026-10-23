import { useState } from "react";
import { Link } from "react-router-dom";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useData } from "@/lib/store";
import { taskKey } from "@/lib/model";
import { cn, download, today } from "@/lib/utils";
import { PageHeader } from "@/components/ui";

interface Item {
  id: string;
  start: string;
  end: string;
  title: string;
  to: string;
  kind: "task" | "sprint" | "release";
  color: string;
}

export function Calendar() {
  const { tasks, sprints, config, me } = useData();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [onlyMine, setOnlyMine] = useState(false);
  const color = (key: string) => config.projects.find((p) => p.key === key)?.color ?? "#64748B";
  const items: Item[] = [
    ...tasks
      .filter((t) => t.meta.due && t.open && (!onlyMine || t.assignees.includes(me.login)))
      .map((t) => ({ id: `t${t.number}`, start: t.meta.due!, end: t.meta.due!, title: `${taskKey(t.project, t.number)} ${t.title}`, to: `/tasks/${t.number}`, kind: "task" as const, color: color(t.project) })),
    ...sprints.filter((s) => s.end).map((s) => ({ id: `s${s.number}`, start: s.start, end: s.end, title: `${s.project} ${s.name}`, to: `/sprints?project=${s.project}`, kind: "sprint" as const, color: color(s.project) })),
    ...config.releases.filter((r) => r.date).map((r) => ({ id: `r${r.id}`, start: r.date, end: r.date, title: `🚀 ${r.project} ${r.name}`, to: `/releases?project=${r.project}`, kind: "release" as const, color: color(r.project) })),
  ];
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });

  const ics = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const d = (s: string) => s.replace(/-/g, "");
    const next = (s: string) => new Date(new Date(s).getTime() + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
    const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sneh Workspace//EN", "X-WR-CALNAME:Sneh Workspace"];
    for (const it of items) lines.push("BEGIN:VEVENT", `UID:${it.id}@sneh-workspace`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d(it.start)}`, `DTEND;VALUE=DATE:${next(it.end)}`, `SUMMARY:${esc(it.title)}`, `URL:${location.origin}${location.pathname}#${it.to}`, "END:VEVENT");
    lines.push("END:VCALENDAR");
    download("sneh-workspace.ics", lines.join("\r\n"), "text/calendar");
  };

  return (
    <>
      <PageHeader title={format(month, "MMMM yyyy")} crumb="Calendar">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only my tasks
        </label>
        <button onClick={ics} className="btn-secondary" title="Download and open in Outlook or Google Calendar">
          <Download size={15} /> Export .ics
        </button>
        <div className="flex gap-1">
          <button onClick={() => setMonth(addMonths(month, -1))} className="btn-secondary px-2" aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setMonth(startOfMonth(new Date()))} className="btn-secondary">
            Today
          </button>
          <button onClick={() => setMonth(addMonths(month, 1))} className="btn-secondary px-2" aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </PageHeader>
      <main className="p-6">
        <div className="card grid grid-cols-7 overflow-hidden">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-500">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const here = items.filter((it) => it.start <= iso && iso <= it.end);
            return (
              <div key={iso} className={cn("min-h-28 border-b border-r border-slate-100 p-1.5", !isSameMonth(day, month) && "bg-slate-50/60")}>
                <p className={cn("mb-1 text-xs font-semibold", iso === today() ? "inline-block rounded-full bg-brand-500 px-1.5 text-white" : "text-slate-500")}>{format(day, "d")}</p>
                <div className="flex flex-col gap-0.5">
                  {here.slice(0, 4).map((it) => (
                    <Link
                      key={it.id}
                      to={it.to}
                      title={it.title}
                      className={cn("truncate rounded px-1 py-0.5 text-[11px] font-medium", it.kind === "sprint" ? "text-white" : "bg-surface ring-1 ring-inset")}
                      style={it.kind === "sprint" ? { background: it.color } : { color: it.color, borderColor: it.color, boxShadow: `inset 0 0 0 1px ${it.color}55` }}
                    >
                      {it.title}
                    </Link>
                  ))}
                  {here.length > 4 && <span className="text-[11px] text-slate-500">+{here.length - 4} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
