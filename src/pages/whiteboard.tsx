import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Circle, Hand, ListPlus, Maximize, MousePointer2, Pencil, Square, StickyNote, Trash2, Type, ZoomIn, ZoomOut } from "lucide-react";
import { GitHubError, deletePath, listDir, readText, writeText } from "@/lib/gh";
import { useData } from "@/lib/store";
import { atLeast, uid } from "@/lib/model";
import { cn, errorText } from "@/lib/utils";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";

type Kind = "sticky" | "text" | "rect" | "ellipse" | "path";
interface Item {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text: string;
  points?: [number, number][];
  task?: number;
}
interface Board {
  name: string;
  items: Item[];
}

const COLORS = ["#FDE68A", "#FBCFE8", "#BBF7D0", "#BFDBFE", "#DDD6FE", "#FED7AA", "#E2E8F0", "#0F172A"];

export function Whiteboards() {
  const { role, me } = useData();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<{ id: string; name: string; sha: string; path: string }[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    listDir("whiteboards").then(async (files) => {
      const list = await Promise.all(
        files
          .filter((f) => f.name.endsWith(".json"))
          .map(async (f) => {
            const t = await readText(f.path);
            return { id: f.name.replace(/\.json$/, ""), name: t ? (JSON.parse(t.text) as Board).name : f.name, sha: f.sha, path: f.path };
          }),
      );
      setBoards(list.sort((a, b) => a.name.localeCompare(b.name)));
    }, (e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);
  return (
    <>
      <PageHeader title="Whiteboards">
        {atLeast(role, "member") && (
          <button
            onClick={async () => {
              const name = prompt("Name the whiteboard", "Brainstorm");
              if (!name?.trim()) return;
              const id = uid();
              try {
                await writeText(`whiteboards/${id}.json`, JSON.stringify({ name: name.trim(), items: [] }), `Create whiteboard ${name.trim()} (${me.login})`);
                navigate(`/whiteboard/${id}`);
              } catch (e) {
                setError(errorText(e));
              }
            }}
            className="btn-primary"
          >
            + New whiteboard
          </button>
        )}
      </PageHeader>
      <main className="mx-auto w-full max-w-5xl p-6">
        <ErrorNote error={error} />
        {boards === null ? (
          <Spinner />
        ) : boards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <div key={b.id} className="card flex items-center gap-2 p-4 hover:border-brand-500">
                <Link to={`/whiteboard/${b.id}`} className="flex-1 font-semibold">
                  {b.name}
                </Link>
                {atLeast(role, "manager") && (
                  <button
                    onClick={() => confirm(`Delete ${b.name}?`) && deletePath(b.path, b.sha, `Delete whiteboard ${b.name} (${me.login})`).then(load, (e) => setError(errorText(e)))}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No whiteboards yet. Sketch ideas with sticky notes, shapes and drawings, then turn stickies into tasks.</Empty>
        )}
      </main>
    </>
  );
}

type Tool = "select" | "pan" | Kind;

export function WhiteboardCanvas() {
  const { id = "" } = useParams();
  const { role, me, config, createTask } = useData();
  const canEdit = atLeast(role, "member");
  const path = `whiteboards/${id}.json`;
  const [board, setBoard] = useState<Board | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const sha = useRef("");
  const changed = useRef(new Set<string>());
  const deleted = useRef(new Set<string>());
  const saveTimer = useRef<number>();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ mode: "move" | "resize" | "pan" | "draw"; id?: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  const load = useCallback(async () => {
    const f = await readText(path);
    if (!f) throw new Error("This whiteboard was deleted.");
    sha.current = f.sha;
    return JSON.parse(f.text) as Board;
  }, [path]);

  useEffect(() => {
    load().then(setBoard, (e) => setError(errorText(e)));
  }, [load]);

  // Pick up teammates' edits while idle.
  useEffect(() => {
    const t = setInterval(async () => {
      if (changed.current.size || deleted.current.size || drag.current || editingText) return;
      try {
        const f = await readText(path);
        if (f && f.sha !== sha.current) {
          sha.current = f.sha;
          setBoard(JSON.parse(f.text));
        }
      } catch {
        /* try again next tick */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [path, editingText]);

  const save = useCallback(async () => {
    const local = boardRef.current;
    if (!local) return;
    setStatus("Saving…");
    for (let attempt = 0; attempt < 4; attempt++) {
      const mine = new Set(changed.current);
      const gone = new Set(deleted.current);
      try {
        sha.current = await writeText(path, JSON.stringify(local), `Edit whiteboard ${local.name} (${me.login})`, sha.current);
        mine.forEach((i) => changed.current.delete(i));
        gone.forEach((i) => deleted.current.delete(i));
        setStatus("Saved");
        return;
      } catch (e) {
        if (!(e instanceof GitHubError && (e.status === 409 || e.status === 422))) {
          setStatus("");
          return setError(errorText(e));
        }
        // Someone else saved: keep their items, layer ours on top.
        const remote = await load();
        const merged = new Map(remote.items.filter((i) => !gone.has(i.id)).map((i) => [i.id, i]));
        for (const i of local.items) if (mine.has(i.id)) merged.set(i.id, i);
        const next = { ...remote, name: local.name, items: [...merged.values()] };
        boardRef.current = next;
        setBoard(next);
        Object.assign(local, next);
      }
    }
    setStatus("");
    setError("Could not save. Reload the page.");
  }, [path, me.login, load]);

  const scheduleSave = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(), 1200);
  };

  const update = (fn: (items: Item[]) => Item[], ids: string[], removed: string[] = []) => {
    setBoard((b) => b && { ...b, items: fn(b.items) });
    ids.forEach((i) => changed.current.add(i));
    removed.forEach((i) => (deleted.current.add(i), changed.current.delete(i)));
    scheduleSave();
  };

  const toBoard = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / view.zoom + view.x, y: (e.clientY - r.top) / view.zoom + view.y };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingText || !selected || !canEdit) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        update((items) => items.filter((i) => i.id !== selected), [], [selected]);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error && !board) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!board) return <Spinner />;
  const sel = board.items.find((i) => i.id === selected);

  const onDown = (e: React.PointerEvent) => {
    const p = toBoard(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "pan" || e.button === 1) {
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, ow: 0, oh: 0 };
      return;
    }
    if (!canEdit) return;
    if (tool === "select") {
      setSelected(null);
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, ow: 0, oh: 0 };
      return;
    }
    const item: Item = {
      id: uid(),
      kind: tool,
      x: p.x,
      y: p.y,
      w: tool === "sticky" ? 180 : tool === "text" ? 220 : 0,
      h: tool === "sticky" ? 140 : tool === "text" ? 40 : 0,
      color: tool === "text" ? "#0F172A" : color,
      text: "",
      points: tool === "path" ? [[0, 0]] : undefined,
    };
    update((items) => [...items, item], [item.id]);
    setSelected(item.id);
    if (tool === "sticky" || tool === "text") {
      setEditingText(item.id);
      setTool("select");
    } else drag.current = { mode: "draw", id: item.id, sx: p.x, sy: p.y, ox: p.x, oy: p.y, ow: 0, oh: 0 };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      setView((v) => ({ ...v, x: d.ox - (e.clientX - d.sx) / v.zoom, y: d.oy - (e.clientY - d.sy) / v.zoom }));
      return;
    }
    const p = toBoard(e);
    const dx = p.x - d.sx;
    const dy = p.y - d.sy;
    update(
      (items) =>
        items.map((i) => {
          if (i.id !== d.id) return i;
          if (d.mode === "move") return { ...i, x: d.ox + dx, y: d.oy + dy };
          if (d.mode === "resize") return { ...i, w: Math.max(20, d.ow + dx), h: Math.max(20, d.oh + dy) };
          if (i.kind === "path") return { ...i, points: [...(i.points ?? []), [p.x - i.x, p.y - i.y]] };
          return { ...i, x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.abs(dx), h: Math.abs(dy) };
        }),
      [d.id!],
    );
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === "draw") {
      const it = boardRef.current?.items.find((i) => i.id === d.id);
      if (it && it.kind !== "path" && it.w < 8 && it.h < 8) update((items) => items.map((i) => (i.id === it.id ? { ...i, w: 140, h: 90 } : i)), [it.id]);
      setTool("select");
    }
  };

  const startMove = (e: React.PointerEvent, item: Item) => {
    if (tool !== "select" || !canEdit) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(item.id);
    const p = toBoard(e);
    drag.current = { mode: "move", id: item.id, sx: p.x, sy: p.y, ox: item.x, oy: item.y, ow: item.w, oh: item.h };
  };

  const fit = () => {
    if (!board.items.length) return setView({ x: 0, y: 0, zoom: 1 });
    const r = svg.current!.getBoundingClientRect();
    const xs = board.items.flatMap((i) => [i.x, i.x + Math.max(i.w, 1)]);
    const ys = board.items.flatMap((i) => [i.y, i.y + Math.max(i.h, 1)]);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    const zoom = Math.min(2, r.width / (Math.max(...xs) + 40 - minX), r.height / (Math.max(...ys) + 40 - minY));
    setView({ x: minX, y: minY, zoom });
  };

  const tools: [Tool, typeof MousePointer2, string][] = [
    ["select", MousePointer2, "Select and move"],
    ["pan", Hand, "Pan"],
    ["sticky", StickyNote, "Sticky note"],
    ["text", Type, "Text"],
    ["rect", Square, "Rectangle"],
    ["ellipse", Circle, "Ellipse"],
    ["path", Pencil, "Draw"],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={board.name} crumb="Whiteboards">
        <span className="text-xs text-slate-500">{status}</span>
        {canEdit && (
          <button
            onClick={() => {
              const name = prompt("Rename whiteboard", board.name);
              if (name?.trim()) {
                setBoard({ ...board, name: name.trim() });
                scheduleSave();
              }
            }}
            className="btn-secondary h-8"
          >
            Rename
          </button>
        )}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-4 py-2">
        {tools.map(([t, Icon, label]) => (
          <button key={t} disabled={!canEdit && t !== "select" && t !== "pan"} onClick={() => setTool(t)} title={label} className={cn("rounded-lg p-2", tool === t ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
            <Icon size={17} />
          </button>
        ))}
        <span className="mx-2 h-6 w-px bg-slate-200" />
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              if (sel && canEdit) update((items) => items.map((i) => (i.id === sel.id ? { ...i, color: c } : i)), [sel.id]);
            }}
            className={cn("h-6 w-6 rounded-full border border-slate-300", color === c && "ring-2 ring-brand-500 ring-offset-1")}
            style={{ background: c }}
            aria-label={c}
          />
        ))}
        <span className="mx-2 h-6 w-px bg-slate-200" />
        <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.2) }))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Zoom in">
          <ZoomIn size={17} />
        </button>
        <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.2, v.zoom / 1.2) }))} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Zoom out">
          <ZoomOut size={17} />
        </button>
        <button onClick={fit} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Fit everything">
          <Maximize size={17} />
        </button>
        {sel && canEdit && (
          <>
            <span className="mx-2 h-6 w-px bg-slate-200" />
            {sel.kind === "sticky" && !sel.task && config.projects.length > 0 && (
              <button
                onClick={async () => {
                  const key = config.projects.length === 1 ? config.projects[0].key : prompt(`Which project? (${config.projects.map((p) => p.key).join(", ")})`, config.projects[0].key)?.toUpperCase();
                  if (!key || !config.projects.some((p) => p.key === key)) return;
                  try {
                    const t = await createTask({ project: key, title: sel.text.split("\n")[0].slice(0, 200) || "Task from whiteboard", description: sel.text });
                    update((items) => items.map((i) => (i.id === sel.id ? { ...i, task: t.number } : i)), [sel.id]);
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
                className="btn-secondary h-8"
              >
                <ListPlus size={15} /> Make task
              </button>
            )}
            <button
              onClick={() => {
                update((items) => items.filter((i) => i.id !== sel.id), [], [sel.id]);
                setSelected(null);
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
              title="Delete (Del)"
            >
              <Trash2 size={17} />
            </button>
          </>
        )}
        {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
      </div>
      <svg
        ref={svg}
        className={cn("min-h-0 flex-1 touch-none bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:20px_20px]", tool === "pan" ? "cursor-grab" : tool !== "select" && "cursor-crosshair")}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={(e) => {
          const p = toBoard(e);
          const zoom = Math.min(3, Math.max(0.2, view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
          const r = svg.current!.getBoundingClientRect();
          setView({ zoom, x: p.x - (e.clientX - r.left) / zoom, y: p.y - (e.clientY - r.top) / zoom });
        }}
      >
        <g transform={`scale(${view.zoom}) translate(${-view.x} ${-view.y})`}>
          {board.items.map((i) => {
            const isSel = i.id === selected;
            const common = { onPointerDown: (e: React.PointerEvent) => startMove(e, i), onDoubleClick: () => canEdit && (i.kind === "sticky" || i.kind === "text" || i.kind === "rect" || i.kind === "ellipse") && setEditingText(i.id), style: { cursor: tool === "select" && canEdit ? "move" : undefined } };
            const label = (dark: boolean) =>
              editingText === i.id ? (
                <foreignObject x={i.x} y={i.y} width={Math.max(i.w, 60)} height={Math.max(i.h, 30)}>
                  <textarea
                    ref={(el) => {
                      if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0);
                    }}
                    defaultValue={i.text}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const text = e.target.value;
                      setEditingText(null);
                      if (!text && i.kind === "text") update((items) => items.filter((x) => x.id !== i.id), [], [i.id]);
                      else if (text !== i.text) update((items) => items.map((x) => (x.id === i.id ? { ...x, text } : x)), [i.id]);
                    }}
                    className="h-full w-full resize-none bg-transparent p-2 text-sm outline-none"
                  />
                </foreignObject>
              ) : (
                i.text && (
                  <foreignObject x={i.x} y={i.y} width={Math.max(i.w, 1)} height={Math.max(i.h, 1)} pointerEvents="none">
                    <div className={cn("h-full w-full overflow-hidden whitespace-pre-wrap break-words p-2 text-sm", i.kind !== "sticky" && i.kind !== "text" && "flex items-center justify-center text-center", dark ? "text-white" : "text-ink")}>{i.text}</div>
                  </foreignObject>
                )
              );
            return (
              <g key={i.id}>
                {i.kind === "sticky" && <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} rx={6} fill={i.color} stroke={isSel ? "#F97316" : "#0001"} strokeWidth={isSel ? 2 : 1} filter="drop-shadow(0 2px 3px #0002)" />}
                {i.kind === "text" && <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} fill="transparent" stroke={isSel ? "#F97316" : "none"} strokeDasharray="4 3" />}
                {i.kind === "rect" && <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} rx={4} fill={i.color + "55"} stroke={isSel ? "#F97316" : i.color} strokeWidth={2} />}
                {i.kind === "ellipse" && <ellipse {...common} cx={i.x + i.w / 2} cy={i.y + i.h / 2} rx={i.w / 2} ry={i.h / 2} fill={i.color + "55"} stroke={isSel ? "#F97316" : i.color} strokeWidth={2} />}
                {i.kind === "path" && (
                  <polyline {...common} transform={`translate(${i.x} ${i.y})`} points={(i.points ?? []).map((p) => p.join(",")).join(" ")} fill="none" stroke={isSel ? "#F97316" : i.color === "#FDE68A" ? "#0F172A" : i.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                )}
                {i.kind !== "path" && label(i.color === "#0F172A" && i.kind === "sticky")}
                {i.task && (
                  <foreignObject x={i.x} y={i.y + i.h - 22} width={i.w} height={22}>
                    <Link to={`/tasks/${i.task}`} className="block px-2 text-right text-xs font-bold text-brand-700 underline">
                      #{i.task}
                    </Link>
                  </foreignObject>
                )}
                {isSel && canEdit && i.kind !== "path" && (
                  <rect
                    x={i.x + i.w - 6}
                    y={i.y + i.h - 6}
                    width={12}
                    height={12}
                    fill="#F97316"
                    style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      const p = toBoard(e);
                      drag.current = { mode: "resize", id: i.id, sx: p.x, sy: p.y, ox: i.x, oy: i.y, ow: i.w, oh: i.h };
                    }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <p className="border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500">
        Double-click a note or shape to write in it. Drag empty space to move around, scroll to zoom. Changes save automatically
        {board.items.length ? "" : " · Pick a tool above to start"}.
        {" "}Last loaded {formatDistanceToNow(new Date(), { addSuffix: true })}.
      </p>
    </div>
  );
}
