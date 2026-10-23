import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Bug,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CornerDownLeft,
  FileText,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  GanttChartSquare,
  Home,
  Inbox,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PenTool,
  Rocket,
  Search,
  Settings,
  Sun,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useData } from "@/lib/store";
import { InboxProvider, useInbox } from "@/lib/inbox";
import { type Theme, getTheme, setTheme } from "@/lib/theme";
import { taskKey } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

const GROUPS = [
  {
    label: "",
    items: [
      { to: "/", label: "Home", icon: Home, tone: "bg-orange-100 text-orange-700", end: true },
      { to: "/inbox", label: "Inbox", icon: Inbox, tone: "bg-blue-100 text-blue-700" },
      { to: "/my-tasks", label: "My tasks", icon: CheckSquare, tone: "bg-green-100 text-green-700" },
    ],
  },
  {
    label: "Plan",
    items: [
      { to: "/projects", label: "Projects", icon: FolderKanban, tone: "bg-violet-100 text-violet-700", end: true },
      { to: "/timeline", label: "Timeline", icon: GanttChartSquare, tone: "bg-sky-100 text-sky-700" },
      { to: "/sprints", label: "Sprints", icon: Timer, tone: "bg-amber-100 text-amber-800" },
      { to: "/releases", label: "Releases", icon: Rocket, tone: "bg-pink-100 text-pink-700" },
      { to: "/calendar", label: "Calendar", icon: CalendarDays, tone: "bg-red-100 text-red-700" },
    ],
  },
  {
    label: "Quality",
    items: [
      { to: "/bugs", label: "Bugs", icon: Bug, tone: "bg-red-100 text-red-700" },
      { to: "/qa", label: "QA", icon: FlaskConical, tone: "bg-teal-100 text-teal-700" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/wiki", label: "Wiki", icon: FileText, tone: "bg-indigo-100 text-indigo-700" },
      { to: "/files", label: "Files", icon: FolderOpen, tone: "bg-amber-100 text-amber-800" },
      { to: "/whiteboard", label: "Whiteboard", icon: PenTool, tone: "bg-pink-100 text-pink-700" },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/team", label: "People & workload", icon: Users, tone: "bg-blue-100 text-blue-700" },
      { to: "/activity", label: "Activity", icon: Activity, tone: "bg-green-100 text-green-700" },
    ],
  },
];
const PAGES = GROUPS.flatMap((g) => g.items).concat([{ to: "/settings", label: "Settings", icon: Settings, tone: "bg-slate-200 text-slate-700" }]);

const navItem = (active: boolean) =>
  cn("group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition", active ? "bg-surface text-ink shadow-soft ring-1 ring-slate-200" : "text-slate-600 hover:bg-slate-200/60 hover:text-ink");

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { me, role, config, signOut } = useData();
  const { unread } = useInbox();
  const projects = config.projects.filter((p) => !p.archived);
  const [showProjects, setShowProjects] = useState(true);
  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-100/70 backdrop-blur">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <img src="./favicon.svg" alt="" className="h-8 w-8 rounded-lg shadow-sm" />
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-tight">Sneh Workspace</p>
          <p className="text-[11px] font-medium text-slate-500">Sneh Gurukool</p>
        </div>
      </Link>
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="mt-3 first:mt-1">
            {g.label && <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{g.label}</p>}
            {g.items.map(({ to, label, icon: Icon, end, tone }) => (
              <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => navItem(isActive)}>
                {({ isActive }) => (
                  <>
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition", tone, !isActive && "opacity-80 group-hover:opacity-100")}>
                      <Icon size={14} strokeWidth={2.25} />
                    </span>
                    <span className="flex-1">{label}</span>
                    {to === "/inbox" && unread > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold leading-4 text-white">{unread}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
        {projects.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowProjects(!showProjects)} className="flex w-full items-center gap-1 px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">
              <ChevronRight size={12} className={cn("transition", showProjects && "rotate-90")} /> Projects
            </button>
            {showProjects &&
              projects.map((p) => (
                <NavLink key={p.key} to={`/projects/${p.key}/board`} onClick={onNavigate} className={({ isActive }) => navItem(isActive)}>
                  <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-extrabold text-white" style={{ background: p.color }}>
                    {p.key[0]}
                  </span>
                  <span className="truncate">{p.name}</span>
                </NavLink>
              ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 p-3">
        <Avatar login={me.login} url={me.avatar_url || undefined} name={me.name ?? undefined} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{me.name || me.login}</p>
          <p className="text-[11px] capitalize text-slate-500">{role}</p>
        </div>
        <NavLink to="/settings" onClick={onNavigate} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60 hover:text-ink" title="Settings">
          <Settings size={16} />
        </NavLink>
        <button onClick={signOut} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60 hover:text-ink" title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}

function ThemeButton() {
  const [theme, set] = useState<Theme>(getTheme);
  const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      onClick={() => {
        setTheme(next[theme]);
        set(next[theme]);
      }}
      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
      title={`Theme: ${theme === "system" ? "same as device" : theme}. Click to change.`}
      aria-label="Change theme"
    >
      <Icon size={18} />
    </button>
  );
}

// Jump anywhere: Ctrl+K or ⌘K.
function CommandPalette({ onClose }: { onClose: () => void }) {
  const { tasks, config } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pages = PAGES.filter((p) => !s || p.label.toLowerCase().includes(s)).map((p) => ({ key: p.to, label: p.label, hint: "Page", to: p.to }));
    const projects = config.projects.filter((p) => !p.archived && (!s || p.name.toLowerCase().includes(s) || p.key.toLowerCase().includes(s))).map((p) => ({ key: p.key, label: p.name, hint: "Project", to: `/projects/${p.key}/board` }));
    const found = s
      ? tasks
          .filter((t) => t.title.toLowerCase().includes(s) || taskKey(t.project, t.number).toLowerCase() === s || String(t.number) === s.replace("#", ""))
          .slice(0, 8)
          .map((t) => ({ key: `t${t.number}`, label: t.title, hint: taskKey(t.project, t.number), to: `/tasks/${t.number}` }))
      : [];
    const all = [...found, ...projects, ...pages].slice(0, 12);
    if (s) all.push({ key: "search", label: `Search everything for "${q.trim()}"`, hint: "Search", to: `/search?q=${encodeURIComponent(q.trim())}` });
    return all;
  }, [q, tasks, config.projects]);
  const go = (to: string) => {
    navigate(to);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <Search size={16} className="text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => (setQ(e.target.value), setSel(0))}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") (e.preventDefault(), setSel((n) => Math.min(n + 1, results.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setSel((n) => Math.max(n - 1, 0)));
              if (e.key === "Enter" && results[sel]) go(results[sel].to);
            }}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Jump to a task, project or page…"
          />
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] font-semibold text-slate-400">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.map((r, i) => (
            <button key={r.key} onMouseEnter={() => setSel(i)} onClick={() => go(r.to)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", i === sel ? "bg-brand-50 text-ink" : "text-slate-700")}>
              <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
              <span className="text-xs text-slate-400">{r.hint}</span>
              {i === sel && <CornerDownLeft size={13} className="text-slate-400" />}
            </button>
          ))}
          {!results.length && <p className="p-4 text-center text-sm text-slate-500">Nothing found.</p>}
        </div>
      </div>
    </div>
  );
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { unread } = useInbox();
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-surface/80 px-4 py-2 backdrop-blur">
      <button className="rounded-lg p-1.5 md:hidden" onClick={onMenu} aria-label="Menu">
        <Menu size={20} />
      </button>
      <button onClick={onSearch} className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300">
        <Search size={15} />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="hidden rounded border border-slate-200 bg-surface px-1.5 text-[10px] font-semibold sm:inline">{mac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <ThemeButton />
        <Link to="/inbox" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label="Inbox" title="Inbox">
          <Bell size={18} />
          {unread > 0 && <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-brand-500 px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-surface">{unread > 9 ? "9+" : unread}</span>}
        </Link>
      </div>
    </div>
  );
}

export function Layout() {
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <InboxProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden md:block">
          <Sidebar onNavigate={() => {}} />
        </div>
        {menu && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="bg-slate-50">
              <Sidebar onNavigate={() => setMenu(false)} />
            </div>
            <button className="flex-1 bg-black/50" onClick={() => setMenu(false)} aria-label="Close menu">
              <X className="m-3 ml-auto text-white" />
            </button>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setMenu(true)} onSearch={() => setPalette(true)} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </div>
        {palette && <CommandPalette onClose={() => setPalette(false)} />}
      </div>
    </InboxProvider>
  );
}
