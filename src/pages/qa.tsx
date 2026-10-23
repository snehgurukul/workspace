import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Bug, Pencil, Play, Plus, Save, Trash2 } from "lucide-react";
import { readJson, updateJson } from "@/lib/gh";
import { useData } from "@/lib/store";
import { atLeast, uid } from "@/lib/model";
import { cn, errorText } from "@/lib/utils";
import { Empty, ErrorNote, Modal, PageHeader, Spinner } from "@/components/ui";
import { NoProjects, ProjectPicker, usePickedProject } from "@/components/task-bits";

type Outcome = "untested" | "passed" | "failed" | "blocked" | "skipped";
const OUTCOMES: Outcome[] = ["untested", "passed", "failed", "blocked", "skipped"];
const OUTCOME_STYLE: Record<Outcome, string> = {
  untested: "bg-slate-100 text-slate-600",
  passed: "bg-green-500 text-white",
  failed: "bg-red-600 text-white",
  blocked: "bg-amber-500 text-white",
  skipped: "bg-slate-400 text-white",
};
const BAR: Record<Outcome, string> = { untested: "bg-slate-200", passed: "bg-green-500", failed: "bg-red-600", blocked: "bg-amber-500", skipped: "bg-slate-400" };

interface Case {
  id: string;
  title: string;
  steps: string;
  expected: string;
}
interface Result {
  outcome: Outcome;
  note: string;
  bug?: number;
  by?: string;
  at?: string;
}
interface Run {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  results: Record<string, Result>;
}
interface QaFile {
  cases: Case[];
  runs: Run[];
}
const EMPTY: QaFile = { cases: [], runs: [] };

function OutcomeBar({ run, cases }: { run: Run; cases: Case[] }) {
  const counts = OUTCOMES.map((o) => [o, cases.filter((c) => (run.results[c.id]?.outcome ?? "untested") === o).length] as const);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      {counts.map(([o, n]) => n > 0 && <div key={o} className={BAR[o]} style={{ width: `${(n / cases.length) * 100}%` }} title={`${n} ${o}`} />)}
    </div>
  );
}

export function Qa() {
  const [project, pick, projects] = usePickedProject();
  const { me, role, createTask } = useData();
  const [data, setData] = useState<QaFile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editCase, setEditCase] = useState<Case | "new" | null>(null);
  const [runId, setRunId] = useState("");
  const path = project ? `qa/${project.key}.json` : "";

  const load = useCallback(() => {
    if (!path) return;
    setData(null);
    readJson<QaFile>(path, EMPTY).then((d) => setData({ ...EMPTY, ...d }), (e) => setError(errorText(e)));
  }, [path]);
  useEffect(load, [load]);

  if (!project) return <NoProjects />;
  const canEdit = atLeast(role, "member");
  const change = async (fn: (d: QaFile) => QaFile, message: string) => {
    setBusy(true);
    setError("");
    try {
      setData(await updateJson<QaFile>(path, EMPTY, (d) => fn({ ...EMPTY, ...d }), `${message} (${me.login})`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const run = data?.runs.find((r) => r.id === runId);

  return (
    <>
      <PageHeader title={run ? run.name : "QA"} crumb={run ? `QA / ${project.name}` : undefined}>
        {run ? (
          <button onClick={() => setRunId("")} className="btn-secondary">
            <ArrowLeft size={15} /> Back to QA
          </button>
        ) : (
          <>
            <ProjectPicker value={project} onChange={pick} projects={projects} />
            {canEdit && (
              <>
                <button onClick={() => setEditCase("new")} className="btn-secondary">
                  <Plus size={15} /> Test case
                </button>
                <button
                  disabled={busy || !data?.cases.length}
                  onClick={() => {
                    const name = prompt("Name this test run", `Test run ${new Date().toLocaleDateString()}`);
                    if (!name) return;
                    const id = uid();
                    void change((d) => ({ ...d, runs: [{ id, name, createdAt: new Date().toISOString(), createdBy: me.login, results: {} }, ...d.runs] }), `Start test run ${name}`).then(() => setRunId(id));
                  }}
                  className="btn-primary"
                >
                  <Play size={15} /> Start test run
                </button>
              </>
            )}
          </>
        )}
      </PageHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <ErrorNote error={error} />
        {!data ? (
          <Spinner />
        ) : run ? (
          <>
            <div className="card flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1">
                <OutcomeBar run={run} cases={data.cases} />
                <p className="mt-2 text-xs text-slate-500">
                  Started by {run.createdBy} {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  {run.completedAt && " · completed"}
                </p>
              </div>
              {canEdit && (
                <>
                  <button disabled={busy} onClick={() => change((d) => ({ ...d, runs: d.runs.map((r) => (r.id === run.id ? { ...r, completedAt: r.completedAt ? undefined : new Date().toISOString() } : r)) }), "Update test run")} className="btn-secondary h-8">
                    {run.completedAt ? "Reopen run" : "Mark run complete"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => confirm(`Delete ${run.name}?`) && change((d) => ({ ...d, runs: d.runs.filter((r) => r.id !== run.id) }), "Delete test run").then(() => setRunId(""))}
                    className="btn-ghost h-8 text-red-600"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
            <div className="card divide-y divide-slate-100">
              {data.cases.map((c) => {
                const r = run.results[c.id] ?? { outcome: "untested" as Outcome, note: "" };
                const set = (patch: Partial<Result>) =>
                  change((d) => ({ ...d, runs: d.runs.map((x) => (x.id === run.id ? { ...x, results: { ...x.results, [c.id]: { ...r, ...patch, by: me.login, at: new Date().toISOString() } } } : x)) }), `Record result for ${c.title}`);
                return (
                  <div key={c.id} className="p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{c.title}</p>
                        {c.steps && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{c.steps}</p>}
                        {c.expected && <p className="mt-1 text-sm text-slate-600"><b>Expected:</b> {c.expected}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {OUTCOMES.filter((o) => o !== "untested").map((o) => (
                          <button key={o} disabled={!canEdit || busy} onClick={() => set({ outcome: r.outcome === o ? "untested" : o })} className={cn("tag cursor-pointer px-2 py-1", r.outcome === o ? OUTCOME_STYLE[o] : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input disabled={!canEdit} defaultValue={r.note} onBlur={(e) => e.target.value !== r.note && set({ note: e.target.value })} className="input h-8 flex-1" placeholder="Note" />
                      {r.bug ? (
                        <Link to={`/tasks/${r.bug}`} className="text-sm font-semibold text-red-600 hover:underline">
                          Bug #{r.bug}
                        </Link>
                      ) : (
                        r.outcome === "failed" &&
                        canEdit && (
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const t = await createTask({ project: project.key, title: `Test failed: ${c.title}`, type: "bug", priority: "high", description: r.note, meta: { severity: "major", steps: c.steps, env: run.name } });
                                await set({ bug: t.number });
                              } catch (e) {
                                setError(errorText(e));
                                setBusy(false);
                              }
                            }}
                            className="btn-secondary h-8"
                          >
                            <Bug size={14} /> File bug
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <section>
              <h2 className="mb-2 font-bold">Test runs</h2>
              {data.runs.length ? (
                <div className="card divide-y divide-slate-100">
                  {data.runs.map((r) => (
                    <button key={r.id} onClick={() => setRunId(r.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50">
                      <span className="w-48 truncate text-sm font-semibold">{r.name}</span>
                      <OutcomeBar run={r} cases={data.cases} />
                      <span className="w-24 shrink-0 text-right text-xs text-slate-500">{r.completedAt ? "complete" : "in progress"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty>No test runs yet. Add test cases, then start a run.</Empty>
              )}
            </section>
            <section>
              <h2 className="mb-2 font-bold">
                Test cases <span className="text-slate-400">{data.cases.length}</span>
              </h2>
              {data.cases.length ? (
                <div className="card divide-y divide-slate-100">
                  {data.cases.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex-1 text-sm font-medium">{c.title}</span>
                      {canEdit && (
                        <>
                          <button onClick={() => setEditCase(c)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Edit">
                            <Pencil size={14} />
                          </button>
                          <button disabled={busy} onClick={() => confirm(`Delete "${c.title}"?`) && change((d) => ({ ...d, cases: d.cases.filter((x) => x.id !== c.id) }), "Delete test case")} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No test cases yet.</Empty>
              )}
            </section>
          </>
        )}
      </main>
      {editCase && (
        <Modal title={editCase === "new" ? "New test case" : "Edit test case"} onClose={() => setEditCase(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const c: Case = { id: editCase === "new" ? uid() : editCase.id, title: String(f.get("title")).trim(), steps: String(f.get("steps") ?? ""), expected: String(f.get("expected") ?? "") };
              void change((d) => ({ ...d, cases: editCase === "new" ? [...d.cases, c] : d.cases.map((x) => (x.id === c.id ? c : x)) }), `Save test case ${c.title}`).then(() => setEditCase(null));
            }}
          >
            <label className="label">
              Title
              <input name="title" required autoFocus defaultValue={editCase === "new" ? "" : editCase.title} className="input" placeholder="Parent can log in with OTP" />
            </label>
            <label className="label">
              Steps
              <textarea name="steps" defaultValue={editCase === "new" ? "" : editCase.steps} className="input min-h-24 py-2 font-normal" />
            </label>
            <label className="label">
              Expected result
              <input name="expected" defaultValue={editCase === "new" ? "" : editCase.expected} className="input" />
            </label>
            <button disabled={busy} className="btn-primary justify-center">
              <Save size={15} /> {busy ? "Saving…" : "Save test case"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
