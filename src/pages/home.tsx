import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useData } from "@/lib/store";
import { taskKey } from "@/lib/model";
import { today } from "@/lib/utils";
import { Empty, PageHeader, Progress } from "@/components/ui";
import { NewTaskButton, TaskRow } from "@/components/task-bits";

export function Home() {
  const { me, tasks, config, sprints } = useData();
  const mine = tasks.filter((t) => t.open && t.assignees.includes(me.login));
  const overdue = mine.filter((t) => t.meta.due && t.meta.due < today());
  const dueSoon = tasks.filter((t) => t.open && t.meta.due && t.meta.due >= today()).sort((a, b) => a.meta.due!.localeCompare(b.meta.due!)).slice(0, 6);
  const openBugs = tasks.filter((t) => t.open && t.type === "bug");
  const active = sprints.filter((s) => s.open);
  const hour = new Date().getHours();
  return (
    <>
      <PageHeader title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${me.name?.split(" ")[0] || me.login}`} crumb={format(new Date(), "EEEE d MMMM")}>
        <NewTaskButton />
      </PageHeader>
      <main className="mx-auto grid w-full max-w-6xl gap-6 p-6 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
          {[
            ["Assigned to me", mine.length, "/my-tasks"],
            ["Overdue", overdue.length, "/my-tasks"],
            ["Open bugs", openBugs.length, "/bugs"],
            ["Active sprints", active.length, "/sprints"],
          ].map(([label, n, to]) => (
            <Link key={label} to={String(to)} className="card p-4 hover:border-brand-500">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-extrabold">{n}</p>
            </Link>
          ))}
        </div>
        <section className="lg:col-span-2">
          <h2 className="mb-2 font-bold">My open tasks</h2>
          {mine.length ? (
            <div className="card overflow-hidden">
              {mine.slice(0, 10).map((t) => (
                <TaskRow key={t.number} task={t} showProject />
              ))}
            </div>
          ) : (
            <Empty>Nothing assigned to you. Nice!</Empty>
          )}
          <h2 className="mb-2 mt-6 font-bold">Projects</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.projects
              .filter((p) => !p.archived)
              .map((p) => {
                const pt = tasks.filter((t) => t.project === p.key);
                return (
                  <Link key={p.key} to={`/projects/${p.key}/board`} className="card p-4 hover:border-brand-500">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ background: p.color }} />
                      <span className="font-semibold">{p.name}</span>
                      <span className="ml-auto text-xs text-slate-500">{p.key}</span>
                    </div>
                    <Progress className="mt-3" done={pt.filter((t) => !t.open).length} total={pt.length} />
                    <p className="mt-1 text-xs text-slate-500">{pt.filter((t) => t.open).length} open tasks</p>
                  </Link>
                );
              })}
            {!config.projects.length && <Empty>No projects yet. Create one under Projects.</Empty>}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-bold">Coming up</h2>
          <div className="card divide-y divide-slate-100">
            {dueSoon.map((t) => (
              <Link key={t.number} to={`/tasks/${t.number}`} className="block px-4 py-2.5 hover:bg-slate-50">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="text-xs text-slate-500">
                  {taskKey(t.project, t.number)} · due {format(new Date(t.meta.due!), "EEE d MMM")}
                </p>
              </Link>
            ))}
            {!dueSoon.length && <p className="p-4 text-sm text-slate-500">No upcoming due dates.</p>}
          </div>
          {active.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 font-bold">Sprints in progress</h2>
              <div className="flex flex-col gap-2">
                {active.map((s) => {
                  const st = tasks.filter((t) => t.milestone === s.number);
                  return (
                    <Link key={s.number} to={`/sprints?project=${s.project}`} className="card p-3 hover:border-brand-500">
                      <p className="text-sm font-semibold">
                        {s.project} · {s.name}
                      </p>
                      {s.end && <p className="text-xs text-slate-500">ends {format(new Date(s.end), "d MMM")}</p>}
                      <Progress className="mt-2" done={st.filter((t) => !t.open).length} total={st.length} />
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
