import { useState } from "react";
import { Download } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useData } from "@/lib/store";
import { PRIORITIES, type Task } from "@/lib/model";
import { download } from "@/lib/utils";
import { Empty } from "@/components/ui";
import { TaskRow } from "@/components/task-bits";
import { ProjectHeader, useProject } from "@/components/project-tabs";
import { EMPTY_FILTER, FilterBar, applyFilter } from "@/components/filters";

const SORTS: Record<string, (a: Task, b: Task) => number> = {
  newest: (a, b) => b.number - a.number,
  priority: (a, b) => PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority),
  due: (a, b) => (a.meta.due ?? "9999").localeCompare(b.meta.due ?? "9999"),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

export function TaskList() {
  const project = useProject();
  const { tasks, me } = useData();
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [sort, setSort] = useState("newest");
  const [showDone, setShowDone] = useState(false);
  if (!project) return <Navigate to="/projects" replace />;
  const list = applyFilter(
    tasks.filter((t) => t.project === project.key && (showDone || t.open)),
    filter,
    me.login,
  ).sort(SORTS[sort]);
  const csv = () => {
    const rows = [["Key", "Title", "Type", "Status", "Priority", "Assignees", "Due", "Estimate", "Open"]].concat(
      list.map((t) => [`${t.project}-${t.number}`, t.title, t.type, t.status, t.priority, t.assignees.join(" "), t.meta.due ?? "", String(t.meta.estimate ?? ""), t.open ? "yes" : "no"]),
    );
    download(`${project.key}-tasks.csv`, rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };
  return (
    <>
      <ProjectHeader />
      <FilterBar value={filter} onChange={setFilter} project={project.key} />
      <div className="flex flex-wrap items-center gap-3 px-6 pt-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input h-8 w-auto">
            <option value="newest">Newest</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
        </label>
        <button onClick={csv} className="btn-ghost ml-auto h-8">
          <Download size={15} /> Download CSV
        </button>
      </div>
      <main className="p-6">
        {list.length ? (
          <div className="card overflow-hidden">
            {list.map((t) => (
              <TaskRow key={t.number} task={t} />
            ))}
          </div>
        ) : (
          <Empty>No tasks match.</Empty>
        )}
      </main>
    </>
  );
}
