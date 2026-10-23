import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { gh, ghAll, GitHubError, readJson, repoPath, updateJson, getToken, getUserId, setToken } from "./gh";
import {
  type Config,
  type GhIssue,
  type GhLabel,
  type GhMilestone,
  type GhUser,
  type Announcement,
  type Meta,
  type Person,
  type Priority,
  type Project,
  type Role,
  type Sprint,
  type Task,
  type TaskType,
  joinBody,
  roleFrom,
  taskLabels,
  toSprint,
  toTask,
} from "./model";

export interface Member extends GhUser {
  role: Role;
}

const toMember = (p: Person): Member => ({ login: p.id, name: p.name, avatar_url: "", role: p.role });

interface State {
  me: GhUser;
  role: Role;
  config: Config;
  tasks: Task[];
  sprints: Sprint[];
  members: Member[];
  people: Person[];
  announcements: Announcement[];
  // True when signed in with a workspace user ID and password.
  passwordLogin: boolean;
}

export interface NewTask {
  project: string;
  title: string;
  description?: string;
  type?: TaskType;
  priority?: Priority;
  status?: string;
  assignees?: string[];
  sprint?: number | null;
  release?: string;
  meta?: Meta;
}

export type TaskPatch = Partial<Pick<Task, "title" | "description" | "type" | "priority" | "status" | "release" | "assignees" | "milestone" | "otherLabels" | "project">> & {
  meta?: Partial<Meta>;
};

const EMPTY: Config = { projects: [], releases: [] };

const LABEL_COLORS: Record<string, string> = {
  "type:bug": "DC2626",
  "type:feature": "7C3AED",
  "type:story": "16A34A",
  "type:task": "2563EB",
  "priority:urgent": "B91C1C",
  "priority:high": "EA580C",
  "priority:medium": "CA8A04",
  "priority:low": "64748B",
};

function useWorkspace() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(getToken()));
  const labels = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!getToken()) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      const userId = getUserId();
      const [ghMe, repo] = await Promise.all([gh<GhUser>("/user"), gh<{ permissions?: Record<string, boolean> }>(repoPath(""))]);
      const [issues, milestones, config, labelList, people, announcements] = await Promise.all([
        ghAll<GhIssue>(repoPath("/issues?state=all")),
        ghAll<GhMilestone>(repoPath("/milestones?state=all")),
        readJson<Config>("config.json", EMPTY).catch(() => EMPTY),
        ghAll<GhLabel>(repoPath("/labels")),
        readJson<Person[]>("people.json", []).catch(() => [] as Person[]),
        readJson<Announcement[]>("announcements.json", []).catch(() => [] as Announcement[]),
      ]);
      labels.current = new Set(labelList.map((l) => l.name));
      let me: GhUser = ghMe;
      let role = roleFrom(repo.permissions);
      if (userId) {
        const person = people.find((p) => p.id === userId);
        if (!person) {
          setToken("");
          throw new Error("This login has been removed. Ask an admin for a new one.");
        }
        me = { login: person.id, name: person.name, avatar_url: "" };
        role = person.role;
      }
      const members = people.map(toMember);
      if (!userId && !members.some((m) => m.login === me.login)) members.push({ ...me, role });
      setState({
        me,
        role,
        people,
        announcements,
        passwordLogin: Boolean(userId),
        config: { ...EMPTY, ...config },
        tasks: issues.filter((i) => !i.pull_request).map(toTask),
        sprints: milestones.map(toSprint).filter((s): s is Sprint => s !== null),
        members,
      });
    } catch (e) {
      if (e instanceof GitHubError && e.status === 401) setToken("");
      setError(e instanceof GitHubError && e.status === 404 ? `This GitHub account can't open the workspace repository. Ask an admin to add you to it.` : e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Picks up teammates' changes when the tab comes back into view.
  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && state && void load();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load, state]);

  const ensureLabels = useCallback(
    async (names: string[], projects: Project[]) => {
      for (const name of names) {
        if (labels.current.has(name)) continue;
        const project = name.startsWith("project:") ? projects.find((p) => `project:${p.key}` === name) : undefined;
        const color = LABEL_COLORS[name] ?? project?.color.replace("#", "") ?? (name.startsWith("status:") ? "CBD5E1" : name.startsWith("release:") ? "0EA5E9" : "E2E8F0");
        try {
          await gh(repoPath("/labels"), { method: "POST", body: { name, color } });
        } catch (e) {
          if (!(e instanceof GitHubError && e.status === 422)) throw e;
        }
        labels.current.add(name);
      }
    },
    [],
  );

  const replaceTask = (issue: GhIssue) =>
    setState((s) => {
      if (!s) return s;
      const t = toTask(issue);
      const exists = s.tasks.some((x) => x.number === t.number);
      return { ...s, tasks: exists ? s.tasks.map((x) => (x.number === t.number ? t : x)) : [t, ...s.tasks] };
    });

  const actions = useMemo(() => {
    const cfg = () => state?.config ?? EMPTY;
    const projectOf = (key: string) => cfg().projects.find((p) => p.key === key);

    // Remembers who assigned each newly added person, so their inbox can say so.
    const assignedMeta = (before: string[], after: string[], current: Meta["assigned"] = {}) => {
      const at = new Date().toISOString();
      const by = state?.me.login ?? "";
      const next = Object.fromEntries(Object.entries(current).filter(([who]) => after.includes(who)));
      for (const who of after) if (!before.includes(who)) next[who] = { by, at };
      return Object.keys(next).length ? next : undefined;
    };

    async function createTask(input: NewTask): Promise<Task> {
      const project = projectOf(input.project);
      const status = input.status ?? project?.statuses[0]?.name ?? "To do";
      const names = taskLabels({ project: input.project, status, type: input.type ?? "task", priority: input.priority ?? "medium", release: input.release ?? "", otherLabels: [] });
      await ensureLabels(names, cfg().projects);
      const issue = await gh<GhIssue>(repoPath("/issues"), {
        method: "POST",
        body: {
          title: input.title.trim(),
          body: joinBody(input.description ?? "", { ...(input.meta ?? {}), people: input.assignees?.length ? input.assignees : undefined, by: state?.me.login, assigned: assignedMeta([], input.assignees ?? []) }),
          labels: names,
          ...(input.sprint ? { milestone: input.sprint } : {}),
        },
      });
      replaceTask(issue);
      return toTask(issue);
    }

    async function updateTask(task: Task, patch: TaskPatch): Promise<void> {
      const next = { ...task, ...patch, meta: { ...task.meta, ...(patch.meta ?? {}), ...(patch.assignees ? { people: patch.assignees, assigned: assignedMeta(task.assignees, patch.assignees, task.meta.assigned) } : {}) } };
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = next.title;
      if (patch.description !== undefined || patch.meta || patch.assignees) body.body = joinBody(next.description, next.meta);
      if (patch.milestone !== undefined) body.milestone = next.milestone;
      if (["type", "priority", "status", "release", "otherLabels", "project"].some((k) => k in patch)) {
        const names = taskLabels(next);
        await ensureLabels(names, cfg().projects);
        body.labels = names;
      }
      if (patch.status !== undefined) {
        const category = projectOf(next.project)?.statuses.find((s) => s.name === next.status)?.category;
        body.state = category === "done" ? "closed" : "open";
        if (category === "done") body.state_reason = "completed";
      }
      replaceTask(await gh<GhIssue>(repoPath(`/issues/${task.number}`), { method: "PATCH", body }));
    }

    async function deleteTask(task: Task) {
      await gh("/graphql", { method: "POST", body: { query: "mutation($id: ID!) { deleteIssue(input: {issueId: $id}) { clientMutationId } }", variables: { id: task.nodeId } } });
      setState((s) => s && { ...s, tasks: s.tasks.filter((t) => t.number !== task.number) });
    }

    async function updateConfig(change: (c: Config) => Config, message: string) {
      const next = await updateJson<Config>("config.json", EMPTY, (c) => change({ ...EMPTY, ...c }), message);
      setState((s) => s && { ...s, config: next });
      return next;
    }

    async function saveSprint(input: { number?: number; project: string; name: string; goal: string; start: string; end: string }) {
      const body = {
        title: `${input.project} · ${input.name.trim()}`,
        description: joinBody(input.goal, { start: input.start } as Meta),
        due_on: input.end ? `${input.end}T23:59:59Z` : null,
      };
      const m = await gh<GhMilestone>(repoPath(input.number ? `/milestones/${input.number}` : "/milestones"), { method: input.number ? "PATCH" : "POST", body });
      const sprint = toSprint(m)!;
      setState((s) => s && { ...s, sprints: [...s.sprints.filter((x) => x.number !== sprint.number), sprint] });
      return sprint;
    }

    async function setSprintOpen(number: number, open: boolean) {
      const m = await gh<GhMilestone>(repoPath(`/milestones/${number}`), { method: "PATCH", body: { state: open ? "open" : "closed" } });
      const sprint = toSprint(m)!;
      setState((s) => s && { ...s, sprints: s.sprints.map((x) => (x.number === number ? sprint : x)) });
    }

    async function deleteSprint(number: number) {
      await gh(repoPath(`/milestones/${number}`), { method: "DELETE" });
      setState((s) => s && { ...s, sprints: s.sprints.filter((x) => x.number !== number), tasks: s.tasks.map((t) => (t.milestone === number ? { ...t, milestone: null } : t)) });
    }

    async function savePeople(change: (p: Person[]) => Person[], message: string) {
      const people = await updateJson<Person[]>("people.json", [], change, message);
      setState((s) => {
        if (!s) return s;
        const members = people.map(toMember);
        if (!s.passwordLogin && !members.some((m) => m.login === s.me.login)) members.push({ ...s.me, role: s.role });
        return { ...s, people, members };
      });
    }

    async function saveAnnouncements(change: (a: Announcement[]) => Announcement[], message: string) {
      const announcements = await updateJson<Announcement[]>("announcements.json", [], change, message);
      setState((s) => s && { ...s, announcements });
    }

    return { createTask, updateTask, deleteTask, updateConfig, saveSprint, setSprintOpen, deleteSprint, savePeople, saveAnnouncements, ensureLabels: (n: string[]) => ensureLabels(n, cfg().projects) };
  }, [state, ensureLabels]);

  const signOut = () => {
    setToken("");
    setState(null);
  };

  return { state, error, loading, reload: load, signOut, ...actions };
}

type Workspace = ReturnType<typeof useWorkspace>;
const Ctx = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const ws = useWorkspace();
  return <Ctx.Provider value={ws}>{children}</Ctx.Provider>;
}

export function useWs() {
  const ws = useContext(Ctx)!;
  return ws;
}

// For pages inside the signed-in layout, where the state is always loaded.
export function useData() {
  const ws = useWs();
  return { ...ws, ...ws.state! };
}
