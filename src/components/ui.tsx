import { useEffect } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import type { Priority, Severity, TaskType } from "@/lib/model";
import { PRIORITY_STYLE, SEVERITY_STYLE, TYPE_STYLE, cn } from "@/lib/utils";

export function Avatar({ login, url, size = 24 }: { login: string; url?: string; size?: number }) {
  return (
    <img
      src={url ?? `https://github.com/${login}.png?size=${size * 2}`}
      alt={login}
      title={login}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-slate-200 ring-2 ring-white"
      style={{ width: size, height: size }}
    />
  );
}

export const TypeTag = ({ type }: { type: TaskType }) => <span className={cn("tag", TYPE_STYLE[type])}>{type}</span>;
export const PriorityTag = ({ priority }: { priority: Priority }) => <span className={cn("tag", PRIORITY_STYLE[priority])}>{priority}</span>;
export const SeverityTag = ({ severity }: { severity: Severity }) => <span className={cn("tag", SEVERITY_STYLE[severity])}>{severity}</span>;

export function Progress({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-500">{pct}%</span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("card w-full p-6 shadow-xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, crumb, children }: { title: string; crumb?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
      <div className="min-w-0 flex-1 basis-56">
        {crumb && <p className="truncate text-xs font-semibold text-slate-500">{crumb}</p>}
        <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export const ErrorNote = ({ error }: { error: string }) => (error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null);

export const Empty = ({ children }: { children: React.ReactNode }) => <div className="card p-8 text-center text-sm text-slate-500">{children}</div>;

export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" /> {label}
  </div>
);

// Task keys like SNEH-12 and #12 become links to the task.
const KEY_RE = /\b([A-Z][A-Z0-9]{1,9})-(\d+)\b|(^|[\s(])#(\d+)\b/g;
function linkKeys(source: string) {
  return source.replace(KEY_RE, (m, key, n1, pre, n2) => (key ? `[${m}](#/tasks/${n1})` : `${pre}[#${n2}](#/tasks/${n2})`));
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("doc", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("#/") ? (
              <Link to={href.slice(1)}>{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {linkKeys(source)}
      </ReactMarkdown>
    </div>
  );
}
