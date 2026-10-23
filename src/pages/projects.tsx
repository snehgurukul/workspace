import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useData } from "@/lib/store";
import { DEFAULT_STATUSES, atLeast } from "@/lib/model";
import { PROJECT_COLORS, errorText } from "@/lib/utils";
import { Empty, ErrorNote, Modal, PageHeader, Progress } from "@/components/ui";

export function Projects() {
  const { config, tasks, role, updateConfig } = useData();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const close = () => {
    setOpen(false);
    setParams({}, { replace: true });
  };
  return (
    <>
      <PageHeader title="Projects">{atLeast(role, "manager") && <button onClick={() => setOpen(true)} className="btn-primary">+ New project</button>}</PageHeader>
      <main className="mx-auto grid w-full max-w-6xl gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {config.projects.map((p) => {
          const pt = tasks.filter((t) => t.project === p.key);
          return (
            <Link key={p.key} to={`/projects/${p.key}/board`} className={`card p-5 hover:border-brand-500 ${p.archived ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-extrabold text-white" style={{ background: p.color }}>
                  {p.key.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.key}
                    {p.archived && " · archived"}
                  </p>
                </div>
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
              <Progress className="mt-4" done={pt.filter((t) => !t.open).length} total={pt.length} />
              <p className="mt-1 text-xs text-slate-500">
                {pt.filter((t) => t.open).length} open · {pt.filter((t) => !t.open).length} done
              </p>
            </Link>
          );
        })}
        {!config.projects.length && <Empty>No projects yet.</Empty>}
      </main>
      {open && (
        <Modal title="New project" onClose={close}>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const key = String(f.get("key")).trim().toUpperCase();
              if (config.projects.some((p) => p.key === key)) return setError(`The key ${key} is already used.`);
              setBusy(true);
              setError("");
              try {
                await updateConfig(
                  (c) => ({
                    ...c,
                    projects: [...c.projects, { key, name: String(f.get("name")).trim(), description: String(f.get("description") ?? "").trim(), color, statuses: DEFAULT_STATUSES }],
                  }),
                  `Create project ${key}`,
                );
                navigate(`/projects/${key}/board`);
              } catch (err) {
                setError(errorText(err));
                setBusy(false);
              }
            }}
          >
            <label className="label">
              Name
              <input name="name" required autoFocus className="input" placeholder="Admissions 2027" />
            </label>
            <label className="label">
              Key (used in task numbers like ADM-12)
              <input name="key" required pattern="[A-Za-z][A-Za-z0-9]{1,9}" maxLength={10} className="input uppercase" placeholder="ADM" />
            </label>
            <label className="label">
              Description
              <textarea name="description" className="input min-h-20 py-2" />
            </label>
            <div className="label">
              Colour
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button type="button" key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full ${c === color ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
            <ErrorNote error={error} />
            <button disabled={busy} className="btn-primary justify-center">
              {busy ? "Creating…" : "Create project"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
