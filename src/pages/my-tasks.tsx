import { useState } from "react";
import { useData } from "@/lib/store";
import { today } from "@/lib/utils";
import { Empty, PageHeader } from "@/components/ui";
import { NewTaskButton, TaskRow } from "@/components/task-bits";

export function MyTasks() {
  const { me, tasks } = useData();
  const [showDone, setShowDone] = useState(false);
  const mine = tasks.filter((t) => t.assignees.includes(me.login) && (showDone || t.open));
  const groups = [
    ["Overdue", mine.filter((t) => t.open && t.meta.due && t.meta.due < today())],
    ["Due later", mine.filter((t) => t.open && t.meta.due && t.meta.due >= today()).sort((a, b) => a.meta.due!.localeCompare(b.meta.due!))],
    ["No due date", mine.filter((t) => t.open && !t.meta.due)],
    ["Done", mine.filter((t) => !t.open)],
  ] as const;
  return (
    <>
      <PageHeader title="My tasks">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
        </label>
        <NewTaskButton defaults={{ assignees: [me.login] }} />
      </PageHeader>
      <main className="mx-auto w-full max-w-5xl p-6">
        {!mine.length && <Empty>Nothing assigned to you yet.</Empty>}
        {groups.map(
          ([label, list]) =>
            list.length > 0 && (
              <section key={label} className="mb-6">
                <h2 className="mb-2 text-sm font-bold text-slate-600">
                  {label} <span className="text-slate-400">{list.length}</span>
                </h2>
                <div className="card overflow-hidden">
                  {list.map((t) => (
                    <TaskRow key={t.number} task={t} showProject />
                  ))}
                </div>
              </section>
            ),
        )}
      </main>
    </>
  );
}
