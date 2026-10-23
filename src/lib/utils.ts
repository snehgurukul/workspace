import type { Category, Priority, Release, Severity, TaskType } from "./model";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const TYPE_STYLE: Record<TaskType, string> = {
  task: "bg-blue-100 text-blue-700",
  bug: "bg-red-100 text-red-700",
  feature: "bg-violet-100 text-violet-700",
  story: "bg-green-100 text-green-700",
};
export const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-600 text-white",
};
export const SEVERITY_STYLE: Record<Severity, string> = {
  trivial: "bg-slate-100 text-slate-600",
  minor: "bg-sky-100 text-sky-700",
  major: "bg-amber-100 text-amber-800",
  critical: "bg-orange-200 text-orange-800",
  blocker: "bg-red-600 text-white",
};
export const CATEGORY_STYLE: Record<Category, string> = {
  todo: "bg-slate-100 text-slate-700",
  doing: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};
export const RELEASE_STYLE: Record<Release["state"], string> = {
  planned: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  released: "bg-green-100 text-green-700",
};

export const PROJECT_COLORS = ["#F97316", "#2563EB", "#16A34A", "#7C3AED", "#DB2777", "#0891B2", "#CA8A04", "#475569"];

export const today = () => new Date().toISOString().slice(0, 10);

export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
