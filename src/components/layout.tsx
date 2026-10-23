import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Bell,
  Bug,
  CalendarDays,
  CheckSquare,
  FileText,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  Home,
  LogOut,
  Menu,
  PenTool,
  Rocket,
  Search,
  Settings,
  Timer,
  Users,
  X,
} from "lucide-react";
import { gh, repoPath } from "@/lib/gh";
import { useData } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/my-tasks", label: "My tasks", icon: CheckSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban, end: true },
  { to: "/sprints", label: "Sprints", icon: Timer },
  { to: "/releases", label: "Releases", icon: Rocket },
  { to: "/bugs", label: "Bugs", icon: Bug },
  { to: "/qa", label: "QA", icon: FlaskConical },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/wiki", label: "Wiki", icon: FileText },
  { to: "/files", label: "Files", icon: FolderOpen },
  { to: "/whiteboard", label: "Whiteboard", icon: PenTool },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/team", label: "Team", icon: Users },
];

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { me, config, signOut } = useData();
  const item = (active: boolean) => cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium", active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink");
  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2 px-4 py-4">
        <img src="./favicon.svg" alt="" className="h-7 w-7" />
        <span className="font-extrabold tracking-tight">Sneh Workspace</span>
      </Link>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => item(isActive)}>
            <Icon size={16} /> {label}
          </NavLink>
        ))}
        {config.projects.filter((p) => !p.archived).length > 0 && <p className="mt-4 px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Projects</p>}
        {config.projects
          .filter((p) => !p.archived)
          .map((p) => (
            <NavLink key={p.key} to={`/projects/${p.key}/board`} onClick={onNavigate} className={({ isActive }) => item(isActive)}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /> <span className="truncate">{p.name}</span>
            </NavLink>
          ))}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 p-3">
        <Avatar login={me.login} url={me.avatar_url} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{me.name || me.login}</span>
        <NavLink to="/settings" onClick={onNavigate} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Settings">
          <Settings size={16} />
        </NavLink>
        <button onClick={signOut} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}

interface Note {
  id: string;
  unread: boolean;
  updated_at: string;
  reason: string;
  subject: { title: string; url: string | null; type: string };
}

function Notifications() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const load = () => gh<Note[]>(repoPath("/notifications?all=true&per_page=30")).then(setNotes, () => setNotes([]));
  useEffect(() => {
    void load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);
  const unread = notes.filter((n) => n.unread).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-4 text-white">{unread}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button onClick={() => gh(repoPath("/notifications"), { method: "PUT", body: {} }).then(load)} className="text-xs font-semibold text-brand-600">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notes.length === 0 && <p className="p-4 text-sm text-slate-500">You're all caught up. Mentions and assignments show up here.</p>}
            {notes.map((n) => {
              const number = n.subject.url?.match(/\/(issues|pulls)\/(\d+)$/)?.[2];
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    void gh(`/notifications/threads/${n.id}`, { method: "PATCH" }).then(load);
                    setOpen(false);
                    if (number) navigate(`/tasks/${number}`);
                  }}
                  className={cn("block w-full border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50", n.unread && "bg-brand-50/50")}
                >
                  <p className="line-clamp-2 text-sm font-medium">{n.subject.title}</p>
                  <p className="text-xs text-slate-500">
                    {n.reason.replace(/_/g, " ")} · {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setMenu(false), [location.pathname]);
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block">
        <Sidebar onNavigate={() => {}} />
      </div>
      {menu && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <Sidebar onNavigate={() => setMenu(false)} />
          <button className="flex-1 bg-slate-900/40" onClick={() => setMenu(false)} aria-label="Close menu">
            <X className="ml-auto m-3 text-white" />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <button className="rounded p-1.5 md:hidden" onClick={() => setMenu(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search tasks and docs" />
          </form>
          <div className="ml-auto">
            <Notifications />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
