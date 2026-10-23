import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useData } from "@/lib/store";
import { SEVERITIES, taskKey } from "@/lib/model";
import { Avatar, Empty, PageHeader, SeverityTag } from "@/components/ui";
import { NewTaskButton } from "@/components/task-bits";

export function Bugs() {
  const { tasks, config } = useData();
  const [project, setProject] = useState("");
  const [state, setState] = useState<"open" | "fixed" | "all">("open");
  const [severity, setSeverity] = useState("");
  const bugs = tasks
    .filter((t) => t.type === "bug" && (!project || t.project === project) && (!severity || t.meta.severity === severity))
    .filter((t) => (state === "open" ? t.open : state === "fixed" ? !t.open : true))
    .sort((a, b) => SEVERITIES.indexOf(b.meta.severity ?? "major") - SEVERITIES.indexOf(a.meta.severity ?? "major") || b.number - a.number);
  return (
    <>
      <PageHeader title="Bugs">
        <NewTaskButton defaults={{ type: "bug", project: project || undefined }} label="Report bug" />
      </PageHeader>
      <div className="flex flex-wrap gap-2 px-6 pt-4">
        <select value={project} onChange={(e) => setProject(e.target.value)} className="input h-8 w-auto">
          <option value="">All projects</option>
          {config.projects.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value as typeof state)} className="input h-8 w-auto">
          <option value="open">Open</option>
          <option value="fixed">Fixed</option>
          <option value="all">All</option>
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input h-8 w-auto capitalize">
          <option value="">Any severity</option>
          {SEVERITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <main className="p-6">
        {bugs.length ? (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {bugs.map((b) => (
              <Link key={b.number} to={`/tasks/${b.number}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <SeverityTag severity={b.meta.severity ?? "major"} />
                <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{taskKey(b.project, b.number)}</span>
                <span className={`min-w-0 flex-1 truncate text-sm font-medium ${b.open ? "" : "text-slate-400"}`}>{b.title}</span>
                {b.meta.env && <span className="hidden text-xs text-slate-500 md:inline">{b.meta.env}</span>}
                <span className="text-xs text-slate-500">{b.status}</span>
                {!b.open && (b.meta.verifiedBy ? <CheckCircle2 size={15} className="text-green-600" aria-label="Verified" /> : <span className="tag bg-amber-100 text-amber-800">verify</span>)}
                {b.assignees[0] && <Avatar login={b.assignees[0]} size={22} />}
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No bugs here.</Empty>
        )}
      </main>
    </>
  );
}
