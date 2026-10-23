import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useData } from "@/lib/store";
import { type Sprint, type Task, atLeast } from "@/lib/model";
import { errorText, today } from "@/lib/utils";
import { Empty, ErrorNote, Modal, PageHeader, Progress } from "@/components/ui";
import { NoProjects, ProjectPicker, TaskRow, usePickedProject } from "@/components/task-bits";

// Ideal line vs remaining points (or tasks) per day, from each task's close date.
function Burndown({ sprint, tasks }: { sprint: Sprint; tasks: Task[] }) {
  if (!sprint.end || !tasks.length) return null;
  const start = new Date(sprint.start);
  const end = new Date(sprint.end);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5));
  const weight = (t: Task) => t.meta.estimate ?? 1;
  const total = tasks.reduce((s, t) => s + weight(t), 0);
  const now = Math.min(days, Math.floor((Date.now() - start.getTime()) / 864e5));
  const points = Array.from({ length: Math.max(0, now) + 1 }, (_, d) => {
    const cutoff = start.getTime() + (d + 1) * 864e5;
    return total - tasks.filter((t) => t.closedAt && new Date(t.closedAt).getTime() < cutoff).reduce((s, t) => s + weight(t), 0);
  });
  const W = 320;
  const H = 120;
  const x = (d: number) => (d / days) * W;
  const y = (v: number) => H - (v / (total || 1)) * H;
  return (
    <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} className="h-32 w-full">
      <line x1={0} y1={y(total)} x2={W} y2={H} stroke="#CBD5E1" strokeDasharray="4 4" />
      <polyline fill="none" stroke="#F97316" strokeWidth={2.5} points={points.map((v, d) => `${x(d)},${y(v)}`).join(" ")} />
    </svg>
  );
}

function SprintDialog({ project, sprint, onClose }: { project: string; sprint?: Sprint; onClose: () => void }) {
  const { saveSprint } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = sprint?.start ?? today();
  return (
    <Modal title={sprint ? "Edit sprint" : "New sprint"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await saveSprint({ number: sprint?.number, project, name: String(f.get("name")), goal: String(f.get("goal") ?? ""), start: String(f.get("start")), end: String(f.get("end")) });
            onClose();
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        <label className="label">
          Name
          <input name="name" required autoFocus defaultValue={sprint?.name} className="input" placeholder="Sprint 1" />
        </label>
        <label className="label">
          Goal
          <textarea name="goal" defaultValue={sprint?.goal} className="input min-h-16 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">
            Start
            <input name="start" type="date" required defaultValue={start} className="input" />
          </label>
          <label className="label">
            End
            <input name="end" type="date" required defaultValue={sprint?.end ?? new Date(Date.now() + 13 * 864e5).toISOString().slice(0, 10)} className="input" />
          </label>
        </div>
        <ErrorNote error={error} />
        <button disabled={busy} className="btn-primary justify-center">
          <Save size={15} /> {busy ? "Saving…" : "Save sprint"}
        </button>
      </form>
    </Modal>
  );
}

export function Sprints() {
  const [project, pick, projects] = usePickedProject();
  const { sprints, tasks, role, updateTask, setSprintOpen, deleteSprint } = useData();
  const [dialog, setDialog] = useState<Sprint | "new" | null>(null);
  const [closing, setClosing] = useState<Sprint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!project) return <NoProjects />;
  const canManage = atLeast(role, "manager");
  const mine = sprints.filter((s) => s.project === project.key).sort((a, b) => b.start.localeCompare(a.start));
  const open = mine.filter((s) => s.open);
  const closed = mine.filter((s) => !s.open);
  const backlog = tasks.filter((t) => t.project === project.key && t.open && !t.milestone && !t.meta.parent);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Sprints">
        <ProjectPicker value={project} onChange={pick} projects={projects} />
        {canManage && (
          <button onClick={() => setDialog("new")} className="btn-primary">
            <Plus size={15} /> New sprint
          </button>
        )}
      </PageHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <ErrorNote error={error} />
        {!open.length && <Empty>No active sprint. {canManage ? "Create one to plan the next two weeks." : ""}</Empty>}
        {open.map((s) => {
          const st = tasks.filter((t) => t.milestone === s.number);
          const pts = st.reduce((n, t) => n + (t.meta.estimate ?? 0), 0);
          return (
            <section key={s.number} className="card overflow-hidden">
              <div className="flex flex-wrap items-start gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold">{s.name}</h2>
                  <p className="text-sm text-slate-500">
                    {format(new Date(s.start), "d MMM")} – {s.end ? format(new Date(s.end), "d MMM yyyy") : "no end date"} · {st.length} tasks{pts ? ` · ${pts} points` : ""}
                  </p>
                  {s.goal && <p className="mt-2 text-sm">{s.goal}</p>}
                  <Progress className="mt-3 max-w-sm" done={st.filter((t) => !t.open).length} total={st.length} />
                </div>
                <div className="w-full max-w-xs">
                  <Burndown sprint={s} tasks={st} />
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button onClick={() => setDialog(s)} className="btn-secondary h-8">
                      <Pencil size={15} /> Edit
                    </button>
                    <button onClick={() => setClosing(s)} className="btn-primary h-8">
                      <CheckCircle2 size={15} /> Complete
                    </button>
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100">
                {st.map((t) => (
                  <TaskRow key={t.number} task={t} />
                ))}
                {!st.length && <p className="px-5 py-3 text-sm text-slate-500">No tasks yet. Add them from the backlog below.</p>}
              </div>
            </section>
          );
        })}

        <section>
          <h2 className="mb-2 font-bold">
            Backlog <span className="text-slate-400">{backlog.length}</span>
          </h2>
          {backlog.length ? (
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {backlog.map((t) => (
                <div key={t.number} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <TaskRow task={t} />
                  </div>
                  {atLeast(role, "member") && open.length > 0 && (
                    <select disabled={busy} value="" onChange={(e) => run(() => updateTask(t, { milestone: Number(e.target.value) }))} className="input mr-3 h-8 w-36 text-xs">
                      <option value="">Move to sprint…</option>
                      {open.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty>The backlog is empty.</Empty>
          )}
        </section>

        {closed.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Completed sprints</h2>
            <div className="card divide-y divide-slate-100">
              {closed.map((s) => {
                const st = tasks.filter((t) => t.milestone === s.number);
                return (
                  <div key={s.number} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="flex-1 font-medium">{s.name}</span>
                    <span className="text-slate-500">
                      {st.filter((t) => !t.open).length}/{st.length} done
                    </span>
                    {canManage && (
                      <>
                        <button disabled={busy} onClick={() => run(() => setSprintOpen(s.number, true))} className="text-xs font-semibold text-brand-600">
                          Reopen
                        </button>
                        <button disabled={busy} onClick={() => confirm(`Delete ${s.name}? Its tasks go back to the backlog.`) && run(() => deleteSprint(s.number))} className="text-xs font-semibold text-red-600">
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
      {dialog && <SprintDialog project={project.key} sprint={dialog === "new" ? undefined : dialog} onClose={() => setDialog(null)} />}
      {closing && (
        <Modal title={`Complete ${closing.name}`} onClose={() => setClosing(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const to = Number(new FormData(e.currentTarget).get("to")) || null;
              const unfinished = tasks.filter((t) => t.milestone === closing.number && t.open);
              void run(async () => {
                for (const t of unfinished) await updateTask(t, { milestone: to });
                await setSprintOpen(closing.number, false);
                setClosing(null);
              });
            }}
          >
            <p className="text-sm text-slate-600">{tasks.filter((t) => t.milestone === closing.number && t.open).length} tasks are not done. Where should they go?</p>
            <select name="to" className="input">
              <option value="">Back to the backlog</option>
              {open
                .filter((s) => s.number !== closing.number)
                .map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button disabled={busy} className="btn-primary justify-center">
              <CheckCircle2 size={15} /> {busy ? "Completing…" : "Complete sprint"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export const SprintLink = ({ sprint }: { sprint: Sprint }) => <Link to={`/sprints?project=${sprint.project}`}>{sprint.name}</Link>;
