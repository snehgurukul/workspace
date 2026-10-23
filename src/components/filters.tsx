import { useData } from "@/lib/store";
import { type Task, TYPES } from "@/lib/model";

export interface Filter {
  q: string;
  assignee: string;
  type: string;
  sprint: string;
}
export const EMPTY_FILTER: Filter = { q: "", assignee: "", type: "", sprint: "" };

export function applyFilter(tasks: Task[], f: Filter, me: string) {
  const q = f.q.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q) || String(t.number) === q.replace("#", "")) &&
      (!f.assignee || (f.assignee === "me" ? t.assignees.includes(me) : f.assignee === "none" ? !t.assignees.length : t.assignees.includes(f.assignee))) &&
      (!f.type || t.type === f.type) &&
      (!f.sprint || (f.sprint === "none" ? !t.milestone : String(t.milestone) === f.sprint)),
  );
}

export function FilterBar({ value, onChange, project }: { value: Filter; onChange: (f: Filter) => void; project: string }) {
  const { members, sprints } = useData();
  const set = (k: keyof Filter) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
      <input value={value.q} onChange={set("q")} className="input h-8 w-48" placeholder="Filter tasks" />
      <select value={value.assignee} onChange={set("assignee")} className="input h-8 w-auto">
        <option value="">Everyone</option>
        <option value="me">Me</option>
        <option value="none">Unassigned</option>
        {members.map((m) => (
          <option key={m.login} value={m.login}>
            {m.name || m.login}
          </option>
        ))}
      </select>
      <select value={value.type} onChange={set("type")} className="input h-8 w-auto capitalize">
        <option value="">All types</option>
        {TYPES.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select value={value.sprint} onChange={set("sprint")} className="input h-8 w-auto">
        <option value="">All sprints</option>
        <option value="none">No sprint</option>
        {sprints
          .filter((s) => s.project === project)
          .map((s) => (
            <option key={s.number} value={s.number}>
              {s.name}
              {s.open ? "" : " (closed)"}
            </option>
          ))}
      </select>
      {JSON.stringify(value) !== JSON.stringify(EMPTY_FILTER) && (
        <button onClick={() => onChange(EMPTY_FILTER)} className="text-xs font-semibold text-brand-600">
          Clear
        </button>
      )}
    </div>
  );
}
