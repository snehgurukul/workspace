import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useData } from "@/lib/store";
import { type Category, type Status, atLeast } from "@/lib/model";
import { PROJECT_COLORS, errorText } from "@/lib/utils";
import { ErrorNote } from "@/components/ui";
import { ProjectHeader, useProject } from "@/components/project-tabs";

export function ProjectSettings() {
  const project = useProject();
  const { role, tasks, updateConfig, updateTask } = useData();
  const navigate = useNavigate();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  // Each row remembers its original name so renamed statuses can move their tasks.
  const [rows, setRows] = useState<(Status & { from?: string })[]>(project?.statuses.map((s) => ({ ...s, from: s.name })) ?? []);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  if (!project || !atLeast(role, "manager")) return <Navigate to="/projects" replace />;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setNote("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  const saveDetails = () =>
    run("details", async () => {
      await updateConfig((c) => ({ ...c, projects: c.projects.map((p) => (p.key === project.key ? { ...p, name: name.trim() || p.name, description, color } : p)) }), `Update project ${project.key}`);
      setNote("Saved.");
    });

  const saveWorkflow = () =>
    run("workflow", async () => {
      const clean = rows.map((r) => ({ ...r, name: r.name.trim() })).filter((r) => r.name);
      if (!clean.length) throw new Error("Keep at least one status.");
      if (new Set(clean.map((r) => r.name)).size !== clean.length) throw new Error("Two statuses have the same name.");
      if (!clean.some((r) => r.category === "done")) throw new Error("Add a status in the Done group so tasks can be finished.");
      const statuses = clean.map(({ name, category }) => ({ name, category }));
      // Tasks in removed or renamed statuses move to the new name, or to the first status.
      const moveTo = new Map<string, string>();
      for (const s of project.statuses) moveTo.set(s.name, clean.find((r) => r.from === s.name)?.name ?? statuses[0].name);
      await updateConfig((c) => ({ ...c, projects: c.projects.map((p) => (p.key === project.key ? { ...p, statuses } : p)) }), `Update ${project.key} workflow`);
      const affected = tasks.filter((t) => t.project === project.key && moveTo.has(t.status) && moveTo.get(t.status) !== t.status);
      for (const t of affected) await updateTask(t, { status: moveTo.get(t.status)! });
      setRows(statuses.map((s) => ({ ...s, from: s.name })));
      setNote(affected.length ? `Saved, and moved ${affected.length} tasks.` : "Saved.");
    });

  const move = (i: number, d: number) => {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
  };

  return (
    <>
      <ProjectHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <ErrorNote error={error} />
        {note && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{note}</p>}
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="font-bold">Details</h2>
          <label className="label">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="label">
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-20 py-2" />
          </label>
          <div className="label">
            Colour
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full ${c === color ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>
          <button disabled={!!busy} onClick={saveDetails} className="btn-primary self-start">
            <Save size={15} /> {busy === "details" ? "Saving…" : "Save details"}
          </button>
        </section>

        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-bold">Workflow</h2>
            <p className="text-sm text-slate-500">The columns on the board, in order. Moving a task into a Done status closes it on GitHub.</p>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input flex-1" />
              <select value={r.category} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value as Category } : x)))} className="input w-32">
                <option value="todo">To do</option>
                <option value="doing">In progress</option>
                <option value="done">Done</option>
              </select>
              <button disabled={i === 0} onClick={() => move(i, -1)} className="btn-ghost h-8 px-2" aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="btn-ghost h-8 px-2" aria-label="Move down">
                <ArrowDown size={14} />
              </button>
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="btn-ghost h-8 px-2 hover:text-red-600" aria-label="Remove status">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => setRows([...rows, { name: "", category: "doing" }])} className="btn-secondary">
              <Plus size={15} /> Add status
            </button>
            <button disabled={!!busy} onClick={saveWorkflow} className="btn-primary">
              <Save size={15} /> {busy === "workflow" ? "Saving…" : "Save workflow"}
            </button>
          </div>
        </section>

        <section className="card flex items-center gap-4 p-5">
          <div className="flex-1">
            <h2 className="font-bold">{project.archived ? "Restore project" : "Archive project"}</h2>
            <p className="text-sm text-slate-500">Archived projects are hidden from the menu and pickers. Their tasks stay on GitHub.</p>
          </div>
          <button
            disabled={!!busy}
            onClick={() =>
              run("archive", async () => {
                await updateConfig((c) => ({ ...c, projects: c.projects.map((p) => (p.key === project.key ? { ...p, archived: !p.archived } : p)) }), `${project.archived ? "Restore" : "Archive"} ${project.key}`);
                if (!project.archived) navigate("/projects");
              })
            }
            className="btn-secondary"
          >
            {project.archived ? "Restore" : "Archive"}
          </button>
        </section>
      </main>
    </>
  );
}
