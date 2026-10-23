import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Save } from "lucide-react";
import { format } from "date-fns";
import { useData } from "@/lib/store";
import { type Release, atLeast, uid } from "@/lib/model";
import { RELEASE_STYLE, cn, errorText } from "@/lib/utils";
import { Empty, ErrorNote, Markdown, Modal, PageHeader, Progress } from "@/components/ui";
import { NoProjects, ProjectPicker, TaskRow, usePickedProject } from "@/components/task-bits";

export function Releases() {
  const [project, pick, projects] = usePickedProject();
  const { config, tasks, role, updateConfig, updateTask } = useData();
  const [editing, setEditing] = useState<Release | "new" | null>(null);
  const [openId, setOpenId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!project) return <NoProjects />;
  const canManage = atLeast(role, "manager");
  const list = config.releases.filter((r) => r.project === project.key).sort((a, b) => (b.date || "9").localeCompare(a.date || "9"));

  const save = async (r: Release, renamedFrom?: string) => {
    setBusy(true);
    setError("");
    try {
      await updateConfig((c) => ({ ...c, releases: [...c.releases.filter((x) => x.id !== r.id), r] }), `Save release ${r.name}`);
      if (renamedFrom && renamedFrom !== r.name) for (const t of tasks.filter((t) => t.project === r.project && t.release === renamedFrom)) await updateTask(t, { release: r.name });
      setEditing(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Releases">
        <ProjectPicker value={project} onChange={pick} projects={projects} />
        {canManage && (
          <button onClick={() => setEditing("new")} className="btn-primary">
            <Plus size={15} /> New release
          </button>
        )}
      </PageHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
        <ErrorNote error={error} />
        {!list.length && <Empty>No releases yet. A release groups the tasks that ship together.</Empty>}
        {list.map((r) => {
          const rt = tasks.filter((t) => t.project === r.project && t.release === r.name);
          const open = openId === r.id;
          return (
            <section key={r.id} className="card overflow-hidden">
              <button onClick={() => setOpenId(open ? "" : r.id)} className="flex w-full flex-wrap items-center gap-3 p-5 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{r.name}</h2>
                    <span className={cn("tag", RELEASE_STYLE[r.state])}>{r.state.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {r.date ? `Target ${format(new Date(r.date), "d MMM yyyy")}` : "No target date"} · {rt.length} tasks · {rt.filter((t) => t.open && t.type === "bug").length} open bugs
                  </p>
                </div>
                <Progress className="w-48" done={rt.filter((t) => !t.open).length} total={rt.length} />
              </button>
              {open && (
                <div className="border-t border-slate-100">
                  {r.notes && (
                    <div className="border-b border-slate-100 px-5 py-3">
                      <Markdown source={r.notes} />
                    </div>
                  )}
                  {rt.map((t) => (
                    <TaskRow key={t.number} task={t} />
                  ))}
                  {!rt.length && <p className="px-5 py-3 text-sm text-slate-500">Set the Release field on a task to add it here.</p>}
                  {canManage && (
                    <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
                      <button onClick={() => setEditing(r)} className="btn-secondary h-8">
                        <Pencil size={15} /> Edit
                      </button>
                      {r.state !== "released" && (
                        <button disabled={busy} onClick={() => save({ ...r, state: "released", date: r.date || new Date().toISOString().slice(0, 10) })} className="btn-primary h-8">
                          <CheckCircle2 size={15} /> Mark released
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (!confirm(`Delete ${r.name}? Tasks stay, without a release.`)) return;
                          setBusy(true);
                          try {
                            for (const t of rt) await updateTask(t, { release: "" });
                            await updateConfig((c) => ({ ...c, releases: c.releases.filter((x) => x.id !== r.id) }), `Delete release ${r.name}`);
                          } catch (e) {
                            setError(errorText(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="btn-ghost h-8 text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>
      {editing && (
        <Modal title={editing === "new" ? "New release" : `Edit ${editing.name}`} onClose={() => setEditing(null)} wide>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("name")).trim().replace(/[,:]/g, "");
              const base = editing === "new" ? { id: uid(), project: project.key } : editing;
              if (config.releases.some((x) => x.project === project.key && x.name === name && x.id !== base.id)) return setError("Another release has that name.");
              void save(
                { ...base, name, date: String(f.get("date") ?? ""), state: f.get("state") as Release["state"], notes: String(f.get("notes") ?? "") },
                editing === "new" ? undefined : editing.name,
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="label sm:col-span-1">
                Name
                <input name="name" required autoFocus defaultValue={editing === "new" ? "" : editing.name} className="input" placeholder="v1.0" />
              </label>
              <label className="label">
                Target date
                <input name="date" type="date" defaultValue={editing === "new" ? "" : editing.date} className="input" />
              </label>
              <label className="label">
                State
                <select name="state" defaultValue={editing === "new" ? "planned" : editing.state} className="input">
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="released">Released</option>
                </select>
              </label>
            </div>
            <label className="label">
              Release notes (Markdown)
              <textarea name="notes" defaultValue={editing === "new" ? "" : editing.notes} className="input min-h-32 py-2 font-normal" />
            </label>
            <ErrorNote error={error} />
            <button disabled={busy} className="btn-primary justify-center">
              <Save size={15} /> {busy ? "Saving…" : "Save release"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
