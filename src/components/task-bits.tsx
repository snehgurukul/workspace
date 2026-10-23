import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Ban, CalendarDays, MessageSquare } from "lucide-react";
import { type NewTask, useData } from "@/lib/store";
import { type Priority, type Project, type Severity, type Task, type TaskType, PRIORITIES, SEVERITIES, TYPES, atLeast, taskKey } from "@/lib/model";
import { errorText } from "@/lib/utils";
import { Avatar, ErrorNote, Modal, PriorityTag, SeverityTag, TypeTag } from "./ui";

export function TaskRow({ task, showProject }: { task: Task; showProject?: boolean }) {
  const { config, tasks } = useData();
  const project = config.projects.find((p) => p.key === task.project);
  const blocked = task.meta.blockedBy?.some((n) => tasks.find((t) => t.number === n)?.open);
  return (
    <Link to={`/tasks/${task.number}`} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50">
      <TypeTag type={task.type} />
      <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{taskKey(task.project, task.number)}</span>
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${task.open ? "" : "text-slate-400 line-through"}`}>{task.title}</span>
      {blocked && <Ban size={14} className="text-red-600" />}
      {showProject && project && <span className="hidden text-xs text-slate-500 sm:inline">{project.name}</span>}
      <span className="hidden text-xs text-slate-500 sm:inline">{task.status}</span>
      {task.meta.due && <span className="hidden text-xs text-slate-500 md:inline">{format(new Date(task.meta.due), "d MMM")}</span>}
      <PriorityTag priority={task.priority} />
      <div className="flex -space-x-1.5">
        {task.assignees.slice(0, 3).map((a) => (
          <MemberAvatar key={a} login={a} size={22} />
        ))}
      </div>
    </Link>
  );
}

// Avatar for a teammate by their login, showing their name from the team list.
export function MemberAvatar({ login, size }: { login: string; size?: number }) {
  const { members } = useData();
  const m = members.find((x) => x.login === login);
  return <Avatar login={login} url={m?.avatar_url || undefined} name={m?.name ?? undefined} size={size} />;
}

export function TaskCard({ task }: { task: Task }) {
  const { tasks } = useData();
  const subtasks = tasks.filter((t) => t.meta.parent === task.number);
  const blocked = task.meta.blockedBy?.some((n) => tasks.find((t) => t.number === n)?.open);
  const overdue = task.open && task.meta.due && task.meta.due < new Date().toISOString().slice(0, 10);
  return (
    <div className="card p-3 shadow-sm hover:border-brand-500">
      <Link to={`/tasks/${task.number}`} className="block text-sm font-semibold leading-snug hover:underline">
        {task.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TypeTag type={task.type} />
        <PriorityTag priority={task.priority} />
        {task.meta.severity && task.type === "bug" && <SeverityTag severity={task.meta.severity} />}
        {blocked && (
          <span className="tag bg-red-600 text-white">
            <Ban size={10} className="mr-0.5" /> blocked
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold">{taskKey(task.project, task.number)}</span>
        {task.meta.due && (
          <span className={`flex items-center gap-0.5 ${overdue ? "font-semibold text-red-600" : ""}`}>
            <CalendarDays size={11} /> {format(new Date(task.meta.due), "d MMM")}
          </span>
        )}
        {task.comments > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageSquare size={11} /> {task.comments}
          </span>
        )}
        {subtasks.length > 0 && (
          <span>
            ☑ {subtasks.filter((s) => !s.open).length}/{subtasks.length}
          </span>
        )}
        <div className="ml-auto flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((a) => (
            <MemberAvatar key={a} login={a} size={20} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Reads ?project=KEY, falling back to the first active project.
export function usePickedProject(): [Project | undefined, (key: string) => void, Project[]] {
  const { config } = useData();
  const [params, setParams] = useSearchParams();
  const active = config.projects.filter((p) => !p.archived);
  const picked = active.find((p) => p.key === params.get("project")) ?? active[0];
  return [
    picked,
    (key) => {
      const next = new URLSearchParams(params);
      next.set("project", key);
      setParams(next, { replace: true });
    },
    active,
  ];
}

export function ProjectPicker({ value, onChange, projects }: { value?: Project; onChange: (key: string) => void; projects: Project[] }) {
  return (
    <select value={value?.key ?? ""} onChange={(e) => onChange(e.target.value)} className="input h-9 w-auto min-w-40">
      {projects.map((p) => (
        <option key={p.key} value={p.key}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export function NoProjects() {
  const { role } = useData();
  return (
    <div className="card m-6 p-8 text-center">
      <p className="font-semibold">No projects yet</p>
      <p className="mt-1 text-sm text-slate-500">{atLeast(role, "manager") ? "Create your first project to get started." : "Ask a manager to create a project."}</p>
      {atLeast(role, "manager") && (
        <Link to="/projects?new=1" className="btn-primary mt-4">
          Create a project
        </Link>
      )}
    </div>
  );
}

export function NewTaskButton({ defaults, label = "New task", className = "btn-primary" }: { defaults?: Partial<NewTask>; label?: string; className?: string }) {
  const { role } = useData();
  const [open, setOpen] = useState(false);
  if (!atLeast(role, "member")) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        + {label}
      </button>
      {open && <TaskDialog defaults={defaults} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TaskDialog({ defaults = {}, onClose, onCreated }: { defaults?: Partial<NewTask>; onClose: () => void; onCreated?: (t: Task) => void }) {
  const { config, sprints, members, createTask } = useData();
  const projects = config.projects.filter((p) => !p.archived);
  const [project, setProject] = useState(defaults.project ?? projects[0]?.key ?? "");
  const [type, setType] = useState<TaskType>(defaults.type ?? "task");
  const [priority, setPriority] = useState<Priority>(defaults.priority ?? "medium");
  const [severity, setSeverity] = useState<Severity>("major");
  const [assignee, setAssignee] = useState(defaults.assignees?.[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const statuses = config.projects.find((p) => p.key === project)?.statuses ?? [];
  const projectSprints = sprints.filter((s) => s.project === project && s.open);
  const releases = config.releases.filter((r) => r.project === project && r.state !== "released");

  return (
    <Modal title={type === "bug" ? "Report a bug" : "New task"} onClose={onClose} wide>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const t = await createTask({
              project,
              title: String(f.get("title")),
              description: String(f.get("description") ?? ""),
              type,
              priority,
              status: String(f.get("status") || "") || undefined,
              assignees: assignee ? [assignee] : [],
              sprint: Number(f.get("sprint")) || null,
              release: String(f.get("release") ?? ""),
              meta: {
                due: String(f.get("due") ?? "") || undefined,
                estimate: Number(f.get("estimate")) || undefined,
                parent: defaults.meta?.parent,
                ...(type === "bug" ? { severity, env: String(f.get("env") ?? ""), steps: String(f.get("steps") ?? "") } : {}),
              },
            });
            onCreated?.(t);
            onClose();
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      >
        <input name="title" required autoFocus className="input h-11 text-base font-semibold" placeholder={type === "bug" ? "What went wrong?" : "Task title"} />
        <textarea name="description" className="input min-h-24 py-2" placeholder="Details (Markdown works)" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="label">
            Project
            <select value={project} onChange={(e) => setProject(e.target.value)} className="input">
              {projects.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as TaskType)} className="input capitalize">
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="input capitalize">
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Status
            <select name="status" defaultValue={defaults.status ?? ""} className="input">
              {statuses.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Assignee
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="input">
              <option value="">Nobody</option>
              {members.map((m) => (
                <option key={m.login} value={m.login}>
                  {m.name || m.login}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Due date
            <input name="due" type="date" className="input" />
          </label>
          <label className="label">
            Sprint
            <select name="sprint" defaultValue={defaults.sprint ?? ""} className="input">
              <option value="">None</option>
              {projectSprints.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Release
            <select name="release" defaultValue={defaults.release ?? ""} className="input">
              <option value="">None</option>
              {releases.map((r) => (
                <option key={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Estimate (points)
            <input name="estimate" type="number" min={0} step={0.5} className="input" />
          </label>
        </div>
        {type === "bug" && (
          <div className="grid gap-3 rounded-lg bg-red-50/50 p-3 sm:grid-cols-2">
            <label className="label">
              Severity
              <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="input capitalize">
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Environment
              <input name="env" className="input" placeholder="Chrome on Android, staging…" />
            </label>
            <label className="label sm:col-span-2">
              Steps to reproduce
              <textarea name="steps" className="input min-h-20 py-2" placeholder={"1. Open…\n2. Click…"} />
            </label>
          </div>
        )}
        <ErrorNote error={error} />
        <button disabled={busy || !project} className="btn-primary justify-center">
          {busy ? "Saving…" : type === "bug" ? "Report bug" : "Create task"}
        </button>
      </form>
    </Modal>
  );
}
