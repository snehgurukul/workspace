import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useData } from "@/lib/store";
import { type Task, atLeast } from "@/lib/model";
import { CATEGORY_STYLE, cn, errorText } from "@/lib/utils";
import { ErrorNote } from "@/components/ui";
import { NewTaskButton, TaskCard } from "@/components/task-bits";
import { ProjectHeader, useProject } from "@/components/project-tabs";
import { EMPTY_FILTER, FilterBar, applyFilter } from "@/components/filters";

export function Board() {
  const project = useProject();
  const { tasks, me, role, updateTask } = useData();
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState("");
  const [error, setError] = useState("");
  // Moves show straight away; the server answer replaces them.
  const [moved, setMoved] = useState<Record<number, string>>({});
  if (!project) return <Navigate to="/projects" replace />;
  const canEdit = atLeast(role, "member");
  const doneNames = new Set(project.statuses.filter((s) => s.category === "done").map((s) => s.name));
  const recentDone = Date.now() - 14 * 864e5;
  const visible = applyFilter(
    tasks.filter((t) => t.project === project.key && !t.meta.parent && (t.open || !t.closedAt || new Date(t.closedAt).getTime() > recentDone)),
    filter,
    me.login,
  );
  const statusOf = (t: Task) => moved[t.number] ?? (project.statuses.some((s) => s.name === t.status) ? t.status : t.open ? project.statuses[0].name : [...doneNames][0] ?? t.status);

  const drop = async (status: string) => {
    const task = tasks.find((t) => t.number === dragging);
    setDragging(null);
    setOver("");
    if (!task || statusOf(task) === status) return;
    setMoved((m) => ({ ...m, [task.number]: status }));
    try {
      await updateTask(task, { status });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setMoved((m) => {
        const { [task.number]: _, ...rest } = m;
        void _;
        return rest;
      });
    }
  };

  return (
    <>
      <ProjectHeader />
      <FilterBar value={filter} onChange={setFilter} project={project.key} />
      {error && (
        <div className="px-6 pt-3">
          <ErrorNote error={error} />
        </div>
      )}
      <main className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-6">
        {project.statuses.map((s) => {
          const col = visible.filter((t) => statusOf(t) === s.name);
          return (
            <section
              key={s.name}
              onDragOver={(e) => {
                if (dragging === null) return;
                e.preventDefault();
                setOver(s.name);
              }}
              onDragLeave={() => setOver("")}
              onDrop={() => void drop(s.name)}
              className={cn("flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/80 p-2", over === s.name && "ring-2 ring-brand-500")}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("tag", CATEGORY_STYLE[s.category])}>{s.name}</span>
                <span className="text-xs font-semibold text-slate-500">{col.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {col.map((t) => (
                  <div key={t.number} draggable={canEdit} onDragStart={() => setDragging(t.number)} onDragEnd={() => setDragging(null)} className={cn(dragging === t.number && "opacity-50", canEdit && "cursor-grab")}>
                    <TaskCard task={t} />
                  </div>
                ))}
              </div>
              <NewTaskButton defaults={{ project: project.key, status: s.name }} label="Add" className="btn-ghost mt-1 h-8 justify-start text-xs" />
            </section>
          );
        })}
      </main>
    </>
  );
}
