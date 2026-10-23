import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { Ban, CheckCircle2, ExternalLink, GitCommitHorizontal, GitMerge, GitPullRequest, Trash2, X } from "lucide-react";
import { gh, repoPath } from "@/lib/gh";
import { useData } from "@/lib/store";
import { type GhUser, PRIORITIES, SEVERITIES, TYPES, type Priority, type Severity, type Task, type TaskType, atLeast, taskKey } from "@/lib/model";
import { cn, errorText } from "@/lib/utils";
import { Avatar, ErrorNote, Markdown, Spinner, TypeTag } from "@/components/ui";
import { Attachments } from "@/components/file-list";

interface Comment {
  id: number;
  body: string;
  user: GhUser;
  created_at: string;
}
interface TimelineEvent {
  event: string;
  created_at?: string;
  actor?: GhUser;
  label?: { name: string };
  assignee?: GhUser;
  rename?: { from: string; to: string };
  milestone?: { title: string };
  commit_id?: string;
  commit_url?: string;
  source?: { issue?: { number: number; title: string; html_url: string; state: string; pull_request?: { merged_at: string | null } } };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export function TaskPage() {
  const { number = "" } = useParams();
  const { tasks } = useData();
  const task = tasks.find((t) => t.number === Number(number));
  if (!/^\d+$/.test(number)) return <Navigate to="/" replace />;
  if (!task) return <p className="p-8 text-sm text-slate-500">Task #{number} was not found. It may be a pull request, or it was deleted.</p>;
  return <TaskView key={task.number} task={task} />;
}

function TaskView({ task }: { task: Task }) {
  const { config, tasks, sprints, members, me, role, updateTask, deleteTask, createTask } = useData();
  const navigate = useNavigate();
  const project = config.projects.find((p) => p.key === task.project);
  const canEdit = atLeast(role, "member");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(task.description);
  const [newSub, setNewSub] = useState("");
  const [depKey, setDepKey] = useState("");
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");

  const loadThread = useCallback(() => {
    gh<Comment[]>(repoPath(`/issues/${task.number}/comments?per_page=100`)).then(setComments, (e) => setError(errorText(e)));
    gh<TimelineEvent[]>(repoPath(`/issues/${task.number}/timeline?per_page=100`)).then(setTimeline, () => setTimeline([]));
  }, [task.number]);
  useEffect(loadThread, [loadThread]);

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
  const patch = (p: Parameters<typeof updateTask>[1]) => run(() => updateTask(task, p));

  const subtasks = tasks.filter((t) => t.meta.parent === task.number);
  const parent = task.meta.parent ? tasks.find((t) => t.number === task.meta.parent) : undefined;
  const blockedBy = (task.meta.blockedBy ?? []).map((n) => tasks.find((t) => t.number === n)).filter((t): t is Task => !!t);
  const blocks = tasks.filter((t) => t.meta.blockedBy?.includes(task.number));
  const openBlockers = blockedBy.filter((t) => t.open);
  const statuses = project?.statuses ?? [];
  const doneStatus = statuses.find((s) => s.category === "done")?.name;
  const links = timeline.filter((e) => (e.event === "cross-referenced" && e.source?.issue?.pull_request) || (e.event === "referenced" && e.commit_id));
  const history = timeline.filter((e) => ["labeled", "unlabeled", "assigned", "unassigned", "closed", "reopened", "renamed", "milestoned", "demilestoned"].includes(e.event));

  const findTask = (ref: string) => {
    const n = Number(ref.trim().replace(/^#|^[A-Z][A-Z0-9]*-/i, ""));
    return tasks.find((t) => t.number === n);
  };

  const describe = (e: TimelineEvent) => {
    switch (e.event) {
      case "labeled":
      case "unlabeled": {
        const [kind, value] = (e.label?.name ?? "").split(":");
        if (!value) return `${e.event === "labeled" ? "added" : "removed"} label ${e.label?.name}`;
        return e.event === "labeled" ? `set ${kind} to ${value}` : null;
      }
      case "assigned":
        return `assigned ${e.assignee?.login}`;
      case "unassigned":
        return `unassigned ${e.assignee?.login}`;
      case "closed":
        return "closed this task";
      case "reopened":
        return "reopened this task";
      case "renamed":
        return `renamed it from "${e.rename?.from}"`;
      case "milestoned":
        return `added it to ${e.milestone?.title.split(" · ")[1] ?? e.milestone?.title}`;
      case "demilestoned":
        return `removed it from ${e.milestone?.title.split(" · ")[1] ?? e.milestone?.title}`;
    }
    return null;
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-sm font-semibold text-slate-500">
            {project ? <Link to={`/projects/${project.key}/board`}>{project.name}</Link> : "No project"}
            {parent && (
              <>
                {" / "}
                <Link to={`/tasks/${parent.number}`} className="text-brand-600 hover:underline">
                  {taskKey(parent.project, parent.number)} {parent.title}
                </Link>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeTag type={task.type} />
            <span className="text-sm font-semibold text-slate-500">{taskKey(task.project, task.number)}</span>
            {!task.open && <span className="tag bg-green-100 text-green-700">done</span>}
            {openBlockers.length > 0 && (
              <span className="tag bg-red-600 text-white">
                <Ban size={10} className="mr-1" /> Blocked by {openBlockers.length}
              </span>
            )}
          </div>
          <input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && patch({ title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-2xl font-extrabold tracking-tight outline-none hover:border-slate-200 focus:border-brand-500 disabled:hover:border-transparent"
          />
          <div className="mt-3">
            <ErrorNote error={error} />
          </div>

          <Section title="Description">
            {editing ? (
              <div>
                <textarea autoFocus value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-40 py-2" />
                <div className="mt-2 flex gap-2">
                  <button disabled={busy} onClick={() => (setEditing(false), patch({ description }))} className="btn-primary h-8">
                    Save
                  </button>
                  <button onClick={() => (setDescription(task.description), setEditing(false))} className="btn-secondary h-8">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => canEdit && setEditing(true)} className={cn("min-h-16 rounded-lg p-2", canEdit && "cursor-text hover:bg-slate-100")}>
                {task.description ? <Markdown source={task.description} /> : <span className="text-sm text-slate-400">{canEdit ? "Add a description…" : "No description."}</span>}
              </div>
            )}
          </Section>

          {task.type === "bug" && (
            <Section title="Bug details">
              <div className="card flex flex-col gap-4 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="label">
                    Severity
                    <select disabled={!canEdit} value={task.meta.severity ?? "major"} onChange={(e) => patch({ meta: { severity: e.target.value as Severity } })} className="input capitalize">
                      {SEVERITIES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="label">
                    Environment
                    <input disabled={!canEdit} defaultValue={task.meta.env ?? ""} onBlur={(e) => e.target.value !== (task.meta.env ?? "") && patch({ meta: { env: e.target.value } })} className="input" />
                  </label>
                </div>
                <label className="label">
                  Steps to reproduce
                  <textarea disabled={!canEdit} defaultValue={task.meta.steps ?? ""} onBlur={(e) => e.target.value !== (task.meta.steps ?? "") && patch({ meta: { steps: e.target.value } })} className="input min-h-24 py-2 font-normal" />
                </label>
                {task.meta.verifiedBy ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CheckCircle2 size={16} /> Verified by {task.meta.verifiedBy} {task.meta.verifiedAt && formatDistanceToNow(new Date(task.meta.verifiedAt), { addSuffix: true })}
                  </p>
                ) : (
                  !task.open &&
                  canEdit && (
                    <button disabled={busy} onClick={() => patch({ meta: { verifiedBy: me.login, verifiedAt: new Date().toISOString() } })} className="btn-secondary self-start">
                      <CheckCircle2 size={15} /> Mark fix verified
                    </button>
                  )
                )}
              </div>
            </Section>
          )}

          <Section title={`Subtasks ${subtasks.length ? `${subtasks.filter((s) => !s.open).length}/${subtasks.length}` : ""}`}>
            <div className="card divide-y divide-slate-100">
              {subtasks.map((s) => (
                <div key={s.number} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    disabled={!canEdit || busy}
                    checked={!s.open}
                    onChange={() => {
                      const sp = config.projects.find((p) => p.key === s.project);
                      const target = s.open ? sp?.statuses.find((x) => x.category === "done") : sp?.statuses[0];
                      if (target) void run(() => updateTask(s, { status: target.name }));
                    }}
                  />
                  <Link to={`/tasks/${s.number}`} className={cn("flex-1 text-sm hover:underline", !s.open && "text-slate-400 line-through")}>
                    {s.title}
                  </Link>
                  <span className="text-xs text-slate-500">{taskKey(s.project, s.number)}</span>
                  {s.assignees[0] && <Avatar login={s.assignees[0]} size={20} />}
                </div>
              ))}
              {canEdit && (
                <form
                  className="flex items-center gap-2 px-3 py-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newSub.trim()) return;
                    void run(async () => {
                      await createTask({ project: task.project, title: newSub, type: "task", priority: task.priority, sprint: task.milestone, meta: { parent: task.number } });
                      setNewSub("");
                    });
                  }}
                >
                  <span className="text-slate-400">+</span>
                  <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Add a subtask and press Enter" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
                </form>
              )}
            </div>
          </Section>

          <Section title="Dependencies">
            <div className="card flex flex-col gap-3 p-4 text-sm">
              {[
                ["Blocked by", blockedBy, true],
                ["Blocks", blocks, false],
              ].map(([label, list, mine]) =>
                (list as Task[]).length ? (
                  <div key={String(label)}>
                    <p className="mb-1 text-xs font-semibold text-slate-500">{String(label)}</p>
                    {(list as Task[]).map((t) => (
                      <div key={t.number} className="flex items-center gap-2 py-0.5">
                        <Link to={`/tasks/${t.number}`} className={cn("hover:underline", !t.open && "text-slate-400 line-through")}>
                          {taskKey(t.project, t.number)} {t.title}
                        </Link>
                        {canEdit && (
                          <button
                            onClick={() =>
                              mine
                                ? patch({ meta: { blockedBy: (task.meta.blockedBy ?? []).filter((n) => n !== t.number) } })
                                : run(() => updateTask(t, { meta: { blockedBy: (t.meta.blockedBy ?? []).filter((n) => n !== task.number) } }))
                            }
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Remove"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null,
              )}
              {!blockedBy.length && !blocks.length && <p className="text-slate-500">No dependencies.</p>}
              {canEdit && (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const other = findTask(depKey);
                    if (!other || other.number === task.number) return setError(`Task ${depKey} was not found.`);
                    setDepKey("");
                    void patch({ meta: { blockedBy: [...new Set([...(task.meta.blockedBy ?? []), other.number])] } });
                  }}
                >
                  <input value={depKey} onChange={(e) => setDepKey(e.target.value)} className="input h-8 w-48" placeholder="Blocked by… e.g. ADM-12" />
                  <button className="btn-secondary h-8">Add</button>
                </form>
              )}
            </div>
          </Section>

          <Section title="Attachments">
            <Attachments folder={`files/tasks/${task.number}`} />
          </Section>

          <Section title="Code and links">
            <div className="card divide-y divide-slate-100 text-sm">
              {links.map((e, i) =>
                e.event === "referenced" ? (
                  <a key={i} href={e.commit_url?.replace("api.github.com/repos", "github.com").replace("/commits/", "/commit/")} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    <GitCommitHorizontal size={15} className="text-slate-500" /> Commit <code className="text-xs">{e.commit_id?.slice(0, 7)}</code>
                    <span className="ml-auto text-xs text-slate-500">{e.actor?.login}</span>
                  </a>
                ) : (
                  <a key={i} href={e.source!.issue!.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    {e.source!.issue!.pull_request?.merged_at ? <GitMerge size={15} className="text-violet-600" /> : <GitPullRequest size={15} className="text-green-600" />}
                    <span className="truncate">{e.source!.issue!.title}</span>
                    <span className="ml-auto text-xs text-slate-500">{e.source!.issue!.pull_request?.merged_at ? "merged" : e.source!.issue!.state}</span>
                  </a>
                ),
              )}
              <p className="px-3 py-2 text-xs text-slate-500">
                Mention <code>#{task.number}</code> in a commit message or pull request on GitHub and it shows up here. Writing <code>Fixes #{task.number}</code> in a pull request closes this task when it merges.
              </p>
            </div>
          </Section>

          <section className="mt-8">
            <div className="mb-3 flex gap-4 border-b border-slate-200">
              {(["comments", "activity"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 pb-2 text-sm font-semibold capitalize", tab === t ? "border-brand-500" : "border-transparent text-slate-500")}>
                  {t}
                </button>
              ))}
            </div>
            {tab === "comments" ? (
              <div className="flex flex-col gap-4">
                {comments === null && <Spinner />}
                {comments?.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar login={c.user.login} url={c.user.avatar_url} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{c.user.login}</span> <span className="text-xs text-slate-500">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                        {(c.user.login === me.login || atLeast(role, "manager")) && (
                          <button
                            onClick={() => confirm("Delete this comment?") && run(async () => (await gh(repoPath(`/issues/comments/${c.id}`), { method: "DELETE" }), loadThread()))}
                            className="ml-2 text-xs text-slate-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </p>
                      <Markdown source={c.body} className="mt-1" />
                    </div>
                  </div>
                ))}
                {canEdit && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!comment.trim()) return;
                      void run(async () => {
                        await gh(repoPath(`/issues/${task.number}/comments`), { method: "POST", body: { body: comment.trim() } });
                        setComment("");
                        loadThread();
                      });
                    }}
                  >
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && e.currentTarget.form?.requestSubmit()}
                      className="input min-h-20 py-2"
                      placeholder="Write a comment. @mention a teammate to notify them."
                    />
                    <button disabled={busy || !comment.trim()} className="btn-primary mt-2">
                      Comment
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                <li className="text-slate-600">
                  <span className="font-semibold text-ink">{task.author}</span> created this task {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                </li>
                {history.map((e, i) => {
                  const text = describe(e);
                  return text ? (
                    <li key={i} className="text-slate-600">
                      <span className="font-semibold text-ink">{e.actor?.login}</span> {text} {e.created_at && formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <aside className="w-full shrink-0 border-t border-slate-200 bg-white p-6 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div className="flex flex-col gap-4">
          <label className="label">
            Status
            <select disabled={!canEdit || busy} value={task.status} onChange={(e) => patch({ status: e.target.value })} className="input">
              {!statuses.some((s) => s.name === task.status) && <option value={task.status}>{task.status || "None"}</option>}
              {statuses.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          {task.open && doneStatus && canEdit && (
            <button disabled={busy} onClick={() => patch({ status: doneStatus })} className="btn-secondary justify-center">
              <CheckCircle2 size={15} /> Mark done
            </button>
          )}
          <div className="label">
            Assignees
            <div className="flex flex-col gap-1">
              {members.map((m) => (
                <label key={m.login} className="flex items-center gap-2 text-sm font-normal text-ink">
                  <input
                    type="checkbox"
                    disabled={!canEdit || busy}
                    checked={task.assignees.includes(m.login)}
                    onChange={(e) => patch({ assignees: e.target.checked ? [...task.assignees, m.login] : task.assignees.filter((a) => a !== m.login) })}
                  />
                  <Avatar login={m.login} url={m.avatar_url} size={20} /> {m.login}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              Type
              <select disabled={!canEdit || busy} value={task.type} onChange={(e) => patch({ type: e.target.value as TaskType })} className="input capitalize">
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Priority
              <select disabled={!canEdit || busy} value={task.priority} onChange={(e) => patch({ priority: e.target.value as Priority })} className="input capitalize">
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Due date
              <input disabled={!canEdit || busy} type="date" value={task.meta.due ?? ""} onChange={(e) => patch({ meta: { due: e.target.value || undefined } })} className="input" />
            </label>
            <label className="label">
              Estimate
              <input
                disabled={!canEdit || busy}
                type="number"
                min={0}
                step={0.5}
                defaultValue={task.meta.estimate ?? ""}
                onBlur={(e) => Number(e.target.value || 0) !== (task.meta.estimate ?? 0) && patch({ meta: { estimate: Number(e.target.value) || undefined } })}
                className="input"
              />
            </label>
          </div>
          <label className="label">
            Sprint
            <select disabled={!canEdit || busy} value={task.milestone ?? ""} onChange={(e) => patch({ milestone: Number(e.target.value) || null })} className="input">
              <option value="">None</option>
              {sprints
                .filter((s) => s.project === task.project && (s.open || s.number === task.milestone))
                .map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="label">
            Release
            <select disabled={!canEdit || busy} value={task.release} onChange={(e) => patch({ release: e.target.value })} className="input">
              <option value="">None</option>
              {config.releases
                .filter((r) => r.project === task.project)
                .map((r) => (
                  <option key={r.id}>{r.name}</option>
                ))}
            </select>
          </label>
          <label className="label">
            Project
            <select disabled={!atLeast(role, "manager") || busy} value={task.project} onChange={(e) => patch({ project: e.target.value, status: config.projects.find((p) => p.key === e.target.value)?.statuses[0]?.name ?? "", milestone: null, release: "" })} className="input">
              {config.projects.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500">
            Created by {task.author} on {format(new Date(task.createdAt), "d MMM yyyy")}
            <br />
            Updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
          </p>
          <a href={task.url} target="_blank" rel="noreferrer" className="btn-ghost justify-start px-0 text-xs">
            <ExternalLink size={13} /> Open on GitHub
          </a>
          {atLeast(role, "admin") && (
            <button
              disabled={busy}
              onClick={() => confirm(`Delete ${taskKey(task.project, task.number)} for good? This can't be undone.`) && run(async () => (await deleteTask(task), navigate(project ? `/projects/${project.key}/board` : "/")))}
              className="btn-ghost justify-start px-0 text-xs text-red-600 hover:bg-transparent"
            >
              <Trash2 size={13} /> Delete task
            </button>
          )}
        </div>
      </aside>
    </main>
  );
}
