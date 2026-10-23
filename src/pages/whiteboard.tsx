import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Circle, Copy, Frame, Hand, ListPlus, Maximize, MousePointer2, MoveUpRight, Pencil, SmilePlus, Square, StickyNote, Trash2, Type, ZoomIn, ZoomOut } from "lucide-react";
import { GitHubError, deletePath, listDir, readText, writeText } from "@/lib/gh";
import { useData } from "@/lib/store";
import { atLeast, uid } from "@/lib/model";
import { cn, errorText } from "@/lib/utils";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";

type Kind = "sticky" | "text" | "rect" | "ellipse" | "path" | "stamp" | "section" | "line";
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
  // Who added it (shown on sticky notes and stamps).
  by?: string;
  // Connector ends: the ids of the two items it joins.
  from?: string;
  to?: string;
}
interface Board {
  name: string;
  items: Item[];
}

const COLORS = ["#FDE68A", "#FBCFE8", "#BBF7D0", "#BFDBFE", "#DDD6FE", "#FED7AA", "#E2E8F0", "#0F172A"];
const STAMPS = ["👍", "❤️", "⭐", "✅", "❓", "🎉", "🔥", "👀", "+1"];
// Drawn first so sections sit behind everything and connectors behind notes.
const LAYER: Record<Kind, number> = { section: 0, line: 1, rect: 2, ellipse: 2, path: 3, text: 4, sticky: 5, stamp: 6 };
const center = (i: Item) => ({ x: i.x + i.w / 2, y: i.y + i.h / 2 });
// Where the line from a's centre towards b leaves a's box, so arrows stop at the edge.
function edge(a: Item, b: Item) {
  const c = center(a);
  const d = center(b);
  const dx = d.x - c.x;
  const dy = d.y - c.y;
  if (!dx && !dy) return c;
  const t = Math.min(dx ? a.w / 2 / Math.abs(dx) : Infinity, dy ? a.h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

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
  const drag = useRef<{ mode: "move" | "resize" | "pan" | "draw"; id?: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; kids?: { id: string; x: number; y: number }[] } | null>(null);
  const [stamp, setStamp] = useState(STAMPS[0]);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const { members } = useData();
  const nameOf = (l?: string) => (l ? members.find((m) => m.login === l)?.name?.split(" ")[0] || l : "");
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

  const remove = (id: string) => {
    const gone = [id, ...(boardRef.current?.items.filter((i) => i.from === id || i.to === id).map((i) => i.id) ?? [])];
    update((items) => items.filter((i) => !gone.includes(i.id)), [], gone);
  };
  const duplicate = (id: string) => {
    const it = boardRef.current?.items.find((i) => i.id === id);
    if (!it || it.kind === "line") return;
    const copy = { ...it, id: uid(), x: it.x + 24, y: it.y + 24, task: undefined, by: me.login };
    update((items) => [...items, copy], [copy.id]);
    setSelected(copy.id);
  };

  const toBoard = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / view.zoom + view.x, y: (e.clientY - r.top) / view.zoom + view.y };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingText || !selected || !canEdit) return;
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === "Delete" || e.key === "Backspace") && !typing) {
        remove(selected);
        setSelected(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !typing) {
        e.preventDefault();
        duplicate(selected);
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
    if (tool === "line") {
      setLinkFrom(null);
      return;
    }
    if (tool === "select") {
      setSelected(null);
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, ow: 0, oh: 0 };
      return;
    }
    const size: Partial<Record<Kind, [number, number]>> = { sticky: [200, 200], text: [220, 40], stamp: [44, 44] };
    const [w, h] = size[tool] ?? [0, 0];
    const item: Item = {
      id: uid(),
      kind: tool,
      x: tool === "sticky" || tool === "stamp" ? p.x - w / 2 : p.x,
      y: tool === "sticky" || tool === "stamp" ? p.y - h / 2 : p.y,
      w,
      h,
      color: tool === "text" ? "#0F172A" : tool === "section" ? "#E2E8F0" : color,
      text: tool === "stamp" ? stamp : tool === "section" ? "Section" : "",
      points: tool === "path" ? [[0, 0]] : undefined,
      by: me.login,
    };
    update((items) => [...items, item], [item.id]);
    setSelected(tool === "stamp" ? null : item.id);
    if (tool === "stamp") return;
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
          const kid = d.mode === "move" && d.kids?.find((k) => k.id === i.id);
          if (kid) return { ...i, x: kid.x + dx, y: kid.y + dy };
          if (i.id !== d.id) return i;
          if (d.mode === "move") return { ...i, x: d.ox + dx, y: d.oy + dy };
          if (d.mode === "resize") return { ...i, w: Math.max(20, d.ow + dx), h: Math.max(20, d.oh + dy) };
          if (i.kind === "path") return { ...i, points: [...(i.points ?? []), [p.x - i.x, p.y - i.y]] };
          return { ...i, x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.abs(dx), h: Math.abs(dy) };
        }),
      [d.id!, ...(d.mode === "move" ? (d.kids ?? []).map((k) => k.id) : [])],
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
    if (tool === "line" && canEdit && item.kind !== "line") {
      e.stopPropagation();
      if (!linkFrom) return setLinkFrom(item.id);
      if (linkFrom !== item.id) {
        const line: Item = { id: uid(), kind: "line", x: 0, y: 0, w: 0, h: 0, color: "#475569", text: "", from: linkFrom, to: item.id, by: me.login };
        update((items) => [...items, line], [line.id]);
      }
      setLinkFrom(null);
      return;
    }
    if (tool !== "select" || !canEdit) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(item.id);
    const p = toBoard(e);
    // A section carries the things inside it.
    const kids =
      item.kind === "section"
        ? board!.items
            .filter((k) => k.id !== item.id && k.kind !== "line" && k.kind !== "section")
            .filter((k) => {
              const c = center(k);
              return c.x > item.x && c.x < item.x + item.w && c.y > item.y && c.y < item.y + item.h;
            })
            .map((k) => ({ id: k.id, x: k.x, y: k.y }))
        : undefined;
    drag.current = { mode: "move", id: item.id, sx: p.x, sy: p.y, ox: item.x, oy: item.y, ow: item.w, oh: item.h, kids };
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
    ["stamp", SmilePlus, "Stamp"],
    ["line", MoveUpRight, "Connector: click one item, then another"],
    ["section", Frame, "Section"],
    ["text", Type, "Text"],
    ["rect", Square, "Rectangle"],
    ["ellipse", Circle, "Ellipse"],
    ["path", Pencil, "Marker"],
  ];

  const colorable = (tool !== "select" && tool !== "pan" && tool !== "stamp" && tool !== "line" && tool !== "text") || (sel && sel.kind !== "stamp" && sel.kind !== "line" && sel.kind !== "text");
  const items = [...board.items].sort((a, b) => LAYER[a.kind] - LAYER[b.kind]);
  const byId = new Map(board.items.map((i) => [i.id, i]));
  const iconBtn = "rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-ink";

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
      <div className="relative flex min-h-0 flex-1 flex-col">
        <svg
          ref={svg}
          className={cn(
            "min-h-0 flex-1 touch-none bg-slate-50 [background-image:radial-gradient(rgb(var(--slate-300))_1px,transparent_1px)] [background-size:24px_24px]",
            tool === "pan" ? "cursor-grab" : tool !== "select" && "cursor-crosshair",
          )}
          style={{ backgroundPosition: `${-view.x * view.zoom}px ${-view.y * view.zoom}px` }}
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
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
            </marker>
          </defs>
          <g transform={`scale(${view.zoom}) translate(${-view.x} ${-view.y})`}>
            {items.map((i) => {
              const isSel = i.id === selected;
              const common = {
                onPointerDown: (e: React.PointerEvent) => startMove(e, i),
                onDoubleClick: () => {
                  if (!canEdit) return;
                  if (i.kind === "section") {
                    const name = prompt("Section name", i.text);
                    if (name !== null) update((list) => list.map((x) => (x.id === i.id ? { ...x, text: name } : x)), [i.id]);
                  } else if (i.kind === "sticky" || i.kind === "text" || i.kind === "rect" || i.kind === "ellipse") setEditingText(i.id);
                },
                style: { cursor: tool === "line" ? "crosshair" : tool === "select" && canEdit ? "move" : undefined },
              };
              const pad = i.kind === "sticky" ? 14 : 8;
              const label = (light: boolean) =>
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
                        if (!text && i.kind === "text") update((list) => list.filter((x) => x.id !== i.id), [], [i.id]);
                        else if (text !== i.text) update((list) => list.map((x) => (x.id === i.id ? { ...x, text } : x)), [i.id]);
                      }}
                      style={{ padding: pad }}
                      className={cn("h-full w-full resize-none bg-transparent outline-none", i.kind === "sticky" ? "text-[15px] font-medium leading-snug" : "text-sm", light ? "text-white" : i.kind === "text" ? "text-ink" : "text-[#0f172a]")}
                    />
                  </foreignObject>
                ) : (
                  i.text && (
                    <foreignObject x={i.x} y={i.y} width={Math.max(i.w, 1)} height={Math.max(i.h, 1)} pointerEvents="none">
                      <div
                        style={{ padding: pad }}
                        className={cn(
                          "h-full w-full overflow-hidden whitespace-pre-wrap break-words",
                          i.kind === "sticky" ? "pb-7 text-[15px] font-medium leading-snug" : "text-sm",
                          i.kind !== "sticky" && i.kind !== "text" && "flex items-center justify-center text-center",
                          light ? "text-white" : i.kind === "text" ? "text-ink" : "text-[#0f172a]",
                        )}
                      >
                        {i.text}
                      </div>
                    </foreignObject>
                  )
                );
              if (i.kind === "line") {
                const a = byId.get(i.from ?? "");
                const b = byId.get(i.to ?? "");
                if (!a || !b) return null;
                const p1 = edge(a, b);
                const p2 = edge(b, a);
                return (
                  <g key={i.id} onPointerDown={(e) => tool === "select" && canEdit && (e.stopPropagation(), setSelected(i.id))}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14} />
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={isSel ? "#F97316" : "rgb(var(--slate-500))"} strokeWidth={2.5} markerEnd="url(#arrow)" pointerEvents="none" />
                  </g>
                );
              }
              return (
                <g key={i.id}>
                  {i.kind === "section" && (
                    <>
                      <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} rx={14} fill={i.color + "66"} stroke={isSel ? "#F97316" : i.color} strokeWidth={isSel ? 2.5 : 1.5} />
                      <foreignObject x={i.x} y={i.y - 30} width={Math.max(i.w, 120)} height={28} pointerEvents="none">
                        <span className="inline-block max-w-full truncate rounded-md px-2 py-0.5 text-sm font-bold text-[#0f172a]" style={{ background: i.color }}>
                          {i.text || "Section"}
                        </span>
                      </foreignObject>
                    </>
                  )}
                  {i.kind === "sticky" && (
                    <>
                      <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} rx={3} fill={i.color} stroke={isSel ? "#F97316" : "#0000"} strokeWidth={isSel ? 2.5 : 0} filter="drop-shadow(0 6px 8px #0f172a22) drop-shadow(0 1px 2px #0f172a22)" />
                      {i.by && (
                        <text x={i.x + 14} y={i.y + i.h - 12} fontSize={11} fontWeight={600} fill={i.color === "#0F172A" ? "#ffffffaa" : "#0f172a88"} pointerEvents="none">
                          {nameOf(i.by)}
                        </text>
                      )}
                    </>
                  )}
                  {i.kind === "stamp" && (
                    <g {...common}>
                      <title>{`${i.text} from ${nameOf(i.by) || "someone"}`}</title>
                      <circle cx={i.x + i.w / 2} cy={i.y + i.h / 2} r={i.w / 2} fill="rgb(var(--surface))" stroke={isSel ? "#F97316" : "rgb(var(--slate-200))"} strokeWidth={isSel ? 2.5 : 1} filter="drop-shadow(0 3px 4px #0f172a22)" />
                      <text x={i.x + i.w / 2} y={i.y + i.h / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={i.text.length > 2 ? 15 : 22} fontWeight={800} fill="#F97316">
                        {i.text}
                      </text>
                    </g>
                  )}
                  {i.kind === "text" && <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} fill="transparent" stroke={isSel ? "#F97316" : "none"} strokeDasharray="4 3" />}
                  {i.kind === "rect" && <rect {...common} x={i.x} y={i.y} width={i.w} height={i.h} rx={6} fill={i.color + "55"} stroke={isSel ? "#F97316" : i.color} strokeWidth={2} />}
                  {i.kind === "ellipse" && <ellipse {...common} cx={i.x + i.w / 2} cy={i.y + i.h / 2} rx={i.w / 2} ry={i.h / 2} fill={i.color + "55"} stroke={isSel ? "#F97316" : i.color} strokeWidth={2} />}
                  {i.kind === "path" && (
                    <polyline {...common} transform={`translate(${i.x} ${i.y})`} points={(i.points ?? []).map((p) => p.join(",")).join(" ")} fill="none" stroke={isSel ? "#F97316" : i.color === "#FDE68A" ? "#0F172A" : i.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {(i.kind === "sticky" || i.kind === "text" || i.kind === "rect" || i.kind === "ellipse") && label(i.color === "#0F172A" && i.kind === "sticky")}
                  {linkFrom === i.id && <rect x={i.x - 4} y={i.y - 4} width={i.w + 8} height={i.h + 8} rx={8} fill="none" stroke="#F97316" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />}
                  {i.task && (
                    <foreignObject x={i.x} y={i.y + i.h - 24} width={i.w} height={22}>
                      <Link to={`/tasks/${i.task}`} className="block px-3 text-right text-xs font-bold text-orange-800 underline">
                        #{i.task}
                      </Link>
                    </foreignObject>
                  )}
                  {isSel && canEdit && i.kind !== "path" && i.kind !== "stamp" && (
                    <rect
                      x={i.x + i.w - 6}
                      y={i.y + i.h - 6}
                      width={12}
                      height={12}
                      rx={3}
                      fill="#fff"
                      stroke="#F97316"
                      strokeWidth={2}
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

        {/* Selection actions */}
        {sel && canEdit && (
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-surface p-1 shadow-lift">
            {sel.kind === "sticky" && !sel.task && config.projects.length > 0 && (
              <button
                onClick={async () => {
                  const key = config.projects.length === 1 ? config.projects[0].key : prompt(`Which project? (${config.projects.map((p) => p.key).join(", ")})`, config.projects[0].key)?.toUpperCase();
                  if (!key || !config.projects.some((p) => p.key === key)) return;
                  try {
                    const t = await createTask({ project: key, title: sel.text.split("\n")[0].slice(0, 200) || "Task from whiteboard", description: sel.text });
                    update((list) => list.map((i) => (i.id === sel.id ? { ...i, task: t.number } : i)), [sel.id]);
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
                className="btn-ghost h-8"
              >
                <ListPlus size={15} /> Make task
              </button>
            )}
            {sel.kind !== "line" && (
              <button onClick={() => duplicate(sel.id)} className={iconBtn} title="Duplicate (Ctrl+D)">
                <Copy size={16} />
              </button>
            )}
            <button
              onClick={() => {
                remove(sel.id);
                setSelected(null);
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
              title="Delete (Del)"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Zoom */}
        <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-xl border border-slate-200 bg-surface p-1 shadow-lift">
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.2, v.zoom / 1.2) }))} className={iconBtn} title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="w-11 text-center text-xs font-semibold text-slate-600">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(3, v.zoom * 1.2) }))} className={iconBtn} title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button onClick={fit} className={iconBtn} title="Fit everything">
            <Maximize size={16} />
          </button>
        </div>

        {error && <p className="absolute left-3 top-3 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>}

        {/* Floating toolbar, like FigJam */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3">
          {canEdit && tool === "stamp" && (
            <div className="pointer-events-auto flex gap-1 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lift">
              {STAMPS.map((st) => (
                <button key={st} onClick={() => setStamp(st)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-lg font-extrabold text-brand-500", stamp === st ? "bg-brand-100" : "hover:bg-slate-100")}>
                  {st}
                </button>
              ))}
            </div>
          )}
          {canEdit && tool === "line" && <p className="pointer-events-auto rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface shadow-lift">{linkFrom ? "Now click the item to point to" : "Click the item to start from"}</p>}
          {canEdit && colorable && (
            <div className="pointer-events-auto flex gap-1.5 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lift">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    if (sel && sel.kind !== "stamp" && sel.kind !== "line") update((list) => list.map((i) => (i.id === sel.id ? { ...i, color: c } : i)), [sel.id]);
                  }}
                  className={cn("h-7 w-7 rounded-full border border-black/10 transition hover:scale-110", (sel?.color ?? color) === c && "ring-2 ring-brand-500 ring-offset-2 ring-offset-surface")}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
          <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-slate-200 bg-surface p-1.5 shadow-lift">
            {tools.map(([t, Icon, label]) => (
              <button
                key={t}
                disabled={!canEdit && t !== "select" && t !== "pan"}
                onClick={() => {
                  setTool(t);
                  setLinkFrom(null);
                }}
                title={label}
                className={cn("shrink-0 rounded-xl p-2.5 transition disabled:opacity-30", tool === t ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100")}
              >
                <Icon size={19} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="hidden border-t border-slate-200 bg-surface px-4 py-1.5 text-xs text-slate-500 sm:block">
        Double-click a note to write in it. Drag empty space to move around, scroll to zoom. Ctrl+D duplicates, Delete removes. Changes save automatically
        {board.items.length ? "" : " · Pick a tool below to start"}. Last loaded {formatDistanceToNow(new Date(), { addSuffix: true })}.
      </p>
    </div>
  );
}
