// How workspace data maps onto GitHub:
// - a task is an issue; labels carry its project, status, type, priority and release
// - extra fields (due date, estimate, bug details, parent, blockers) sit in a hidden comment in the issue body
// - a sprint is a milestone; projects, workflows and releases live in config.json on the data branch

export type Category = "todo" | "doing" | "done";
export type TaskType = "task" | "bug" | "feature" | "story";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Severity = "trivial" | "minor" | "major" | "critical" | "blocker";
export type Role = "admin" | "manager" | "member" | "viewer";

export const TYPES: TaskType[] = ["task", "bug", "feature", "story"];
export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
export const SEVERITIES: Severity[] = ["trivial", "minor", "major", "critical", "blocker"];

export interface Status {
  name: string;
  category: Category;
}
export interface Project {
  key: string;
  name: string;
  color: string;
  description: string;
  statuses: Status[];
  archived?: boolean;
}
export interface Release {
  id: string;
  project: string;
  name: string;
  date: string;
  state: "planned" | "in_progress" | "released";
  notes: string;
}
export interface Config {
  projects: Project[];
  releases: Release[];
  claudeHint?: string;
}

export const DEFAULT_STATUSES: Status[] = [
  { name: "To do", category: "todo" },
  { name: "In progress", category: "doing" },
  { name: "In review", category: "doing" },
  { name: "Done", category: "done" },
];

export interface Meta {
  due?: string;
  estimate?: number;
  severity?: Severity;
  env?: string;
  steps?: string;
  parent?: number;
  blockedBy?: number[];
  verifiedBy?: string;
  verifiedAt?: string;
  people?: string[];
  by?: string;
  // Planned start date, for the timeline.
  start?: string;
  // Hours people logged on the task.
  time?: TimeEntry[];
  // When and by whom each person was assigned, for the inbox.
  assigned?: Record<string, { by: string; at: string }>;
}

export interface TimeEntry {
  by: string;
  date: string;
  hours: number;
  note?: string;
}

// A notice for the whole team, kept in announcements.json on the data branch.
export interface Announcement {
  id: string;
  title: string;
  body: string;
  by: string;
  at: string;
  pinned?: boolean;
}

export interface GhUser {
  login: string;
  avatar_url: string;
  name?: string | null;
}
export interface GhLabel {
  name: string;
  color: string;
}
export interface GhMilestone {
  number: number;
  title: string;
  description: string | null;
  due_on: string | null;
  state: "open" | "closed";
  open_issues: number;
  closed_issues: number;
  created_at: string;
  closed_at: string | null;
}
export interface GhIssue {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: GhLabel[];
  assignees: GhUser[];
  user: GhUser;
  milestone: GhMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  pull_request?: unknown;
}

export interface Task {
  number: number;
  nodeId: string;
  title: string;
  description: string;
  meta: Meta;
  project: string;
  status: string;
  type: TaskType;
  priority: Priority;
  release: string;
  otherLabels: string[];
  assignees: string[];
  milestone: number | null;
  open: boolean;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: string;
  comments: number;
  url: string;
}

const META_RE = /\n*<!-- sneh:(\{[\s\S]*?\}) -->\s*$/;

export function splitBody(body: string | null): { description: string; meta: Meta } {
  const text = body ?? "";
  const m = text.match(META_RE);
  if (!m) return { description: text, meta: {} };
  try {
    return { description: text.slice(0, m.index).trimEnd(), meta: JSON.parse(m[1]) };
  } catch {
    return { description: text, meta: {} };
  }
}
export function joinBody(description: string, meta: Meta): string {
  const clean = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
  return Object.keys(clean).length ? `${description.trimEnd()}\n\n<!-- sneh:${JSON.stringify(clean)} -->` : description;
}

const pick = (labels: string[], prefix: string) => labels.find((l) => l.startsWith(prefix))?.slice(prefix.length) ?? "";

export function toTask(i: GhIssue): Task {
  const names = i.labels.map((l) => l.name);
  const { description, meta } = splitBody(i.body);
  return {
    number: i.number,
    nodeId: i.node_id,
    title: i.title,
    description,
    meta,
    project: pick(names, "project:"),
    status: pick(names, "status:"),
    type: (pick(names, "type:") || "task") as TaskType,
    priority: (pick(names, "priority:") || "medium") as Priority,
    release: pick(names, "release:"),
    otherLabels: names.filter((n) => !/^(project|status|type|priority|release):/.test(n)),
    assignees: meta.people ?? i.assignees.map((a) => a.login),
    milestone: i.milestone?.number ?? null,
    open: i.state === "open",
    closedAt: i.closed_at,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    author: meta.by ?? i.user.login,
    comments: i.comments,
    url: i.html_url,
  };
}

export function taskLabels(t: Pick<Task, "project" | "status" | "type" | "priority" | "release" | "otherLabels">): string[] {
  return [
    `project:${t.project}`,
    t.status && `status:${t.status}`,
    `type:${t.type}`,
    `priority:${t.priority}`,
    t.release && `release:${t.release}`,
    ...t.otherLabels,
  ].filter(Boolean) as string[];
}

// Sprints are milestones titled "KEY · name"; their start date and goal sit in the description.
export interface Sprint {
  number: number;
  project: string;
  name: string;
  goal: string;
  start: string;
  end: string;
  open: boolean;
  closedAt: string | null;
}
export function toSprint(m: GhMilestone): Sprint | null {
  const t = m.title.match(/^([A-Z][A-Z0-9]{1,9}) · (.+)$/);
  if (!t) return null;
  const { description, meta } = splitBody(m.description) as { description: string; meta: { start?: string } };
  return {
    number: m.number,
    project: t[1],
    name: t[2],
    goal: description,
    start: meta.start ?? m.created_at.slice(0, 10),
    end: m.due_on?.slice(0, 10) ?? "",
    open: m.state === "open",
    closedAt: m.closed_at,
  };
}

// Someone who can use the workspace. Kept in people.json on the data branch.
export interface Person {
  id: string;
  name: string;
  role: Role;
}

export const taskKey = (project: string, n: number) => `${project || "#"}-${n}`;

export function roleFrom(p?: { admin?: boolean; maintain?: boolean; push?: boolean }): Role {
  if (p?.admin) return "admin";
  if (p?.maintain) return "manager";
  if (p?.push) return "member";
  return "viewer";
}
const RANK: Record<Role, number> = { viewer: 0, member: 1, manager: 2, admin: 3 };
export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];

export const ROLE_TO_PERMISSION: Record<Role, string> = { admin: "admin", manager: "maintain", member: "push", viewer: "pull" };

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "page";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
