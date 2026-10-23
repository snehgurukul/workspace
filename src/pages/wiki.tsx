import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, FileText, History, Pencil, Plus, Trash2 } from "lucide-react";
import { type CommitInfo, dataTree, deletePath, fileHistory, readText, writeText } from "@/lib/gh";
import { useData } from "@/lib/store";
import { atLeast } from "@/lib/model";
import { cn, errorText } from "@/lib/utils";
import { Empty, ErrorNote, Markdown, Modal, PageHeader, Spinner } from "@/components/ui";

// A page is wiki/<space>/<Title>.md; its sub-pages live in the folder wiki/<space>/<Title>/.
interface Node {
  path: string;
  title: string;
  children: Node[];
}
const titleOf = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");
const cleanTitle = (t: string) => t.replace(/[\\/:*?"<>|#%]+/g, "-").trim();

function buildTree(paths: string[], prefix: string): Node[] {
  const here = paths.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/") && p.endsWith(".md"));
  return here.map((p) => ({ path: p, title: titleOf(p), children: buildTree(paths, p.replace(/\.md$/, "/")) })).sort((a, b) => a.title.localeCompare(b.title));
}

function TreeView({ nodes, current, depth = 0 }: { nodes: Node[]; current: string; depth?: number }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.path}>
          <Link to={`/wiki?p=${encodeURIComponent(n.path)}`} className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-sm", n.path === current ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-700 hover:bg-slate-100")} style={{ paddingLeft: 8 + depth * 14 }}>
            {n.children.length ? <ChevronRight size={12} className="text-slate-400" /> : <FileText size={12} className="text-slate-400" />}
            <span className="truncate">{n.title}</span>
          </Link>
          {n.children.length > 0 && <TreeView nodes={n.children} current={current} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}

export function Wiki() {
  const { config, role, me } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const current = params.get("p") ?? "";
  const space = params.get("space") ?? (current ? current.split("/")[1] : "workspace");
  const [paths, setPaths] = useState<string[] | null>(null);
  const [page, setPage] = useState<{ text: string; sha: string } | null>(null);
  const [history, setHistory] = useState<CommitInfo[] | null>(null);
  const [rev, setRev] = useState<{ sha: string; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [creating, setCreating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit = atLeast(role, "member");

  const loadTree = useCallback(() => {
    dataTree().then((t) => setPaths(t.filter((x) => x.type === "blob" && x.path.startsWith("wiki/")).map((x) => x.path)), (e) => setError(errorText(e)));
  }, []);
  useEffect(loadTree, [loadTree]);

  useEffect(() => {
    setPage(null);
    setHistory(null);
    setRev(null);
    setEditing(false);
    setError("");
    if (current) readText(current).then((p) => (p ? setPage(p) : setError("This page no longer exists.")), (e) => setError(errorText(e)));
  }, [current]);

  const tree = useMemo(() => (paths ? buildTree(paths, `wiki/${space}/`) : []), [paths, space]);
  const spaces = [{ key: "workspace", name: "Whole workspace" }, ...config.projects.filter((p) => !p.archived).map((p) => ({ key: p.key, name: p.name }))];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e).includes("does not match") || errorText(e).includes("409") ? "Someone else saved this page while you were editing. Copy your text, reload, and try again." : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const newTitle = cleanTitle(title) || titleOf(current);
      const hasChildren = paths?.some((p) => p.startsWith(current.replace(/\.md$/, "/")));
      if (newTitle !== titleOf(current)) {
        if (hasChildren) throw new Error("Pages with sub-pages can't be renamed yet. Change the text only, or move the sub-pages first.");
        const to = current.replace(/[^/]+\.md$/, `${newTitle}.md`);
        if (paths?.includes(to)) throw new Error("A page with that title already exists here.");
        await writeText(to, draft, `Rename "${titleOf(current)}" to "${newTitle}" (${me.login})`);
        await deletePath(current, page!.sha, `Rename "${titleOf(current)}" to "${newTitle}" (${me.login})`);
        loadTree();
        navigate(`/wiki?p=${encodeURIComponent(to)}`, { replace: true });
        return;
      }
      const sha = await writeText(current, draft, `Edit "${newTitle}" (${me.login})`, page!.sha);
      setPage({ text: draft, sha });
      setHistory(null);
      setEditing(false);
    });

  return (
    <>
      <PageHeader title="Wiki">
        <select value={space} onChange={(e) => setParams({ space: e.target.value })} className="input h-9 w-auto">
          {spaces.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        {canEdit && (
          <button onClick={() => setCreating(`wiki/${space}/`)} className="btn-primary">
            <Plus size={15} /> New page
          </button>
        )}
      </PageHeader>
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-3 md:w-64 md:overflow-y-auto md:border-b-0 md:border-r">
          {paths === null ? <Spinner /> : tree.length ? <TreeView nodes={tree} current={current} /> : <p className="p-2 text-sm text-slate-500">No pages yet.</p>}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl">
            <ErrorNote error={error} />
            {!current ? (
              <Empty>Pick a page on the left, or create a new one. Pages are written in Markdown and every edit is kept in History.</Empty>
            ) : !page ? (
              !error && <Spinner />
            ) : editing ? (
              <div className="flex flex-col gap-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="input h-12 text-2xl font-extrabold" />
                <div className="flex items-center gap-1 border-b border-slate-200">
                  {(["write", "preview"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 pb-2 text-sm font-semibold capitalize", tab === t ? "border-brand-500" : "border-transparent text-slate-500")}>
                      {t}
                    </button>
                  ))}
                  <span className="ml-auto hidden pb-2 text-xs text-slate-400 sm:inline"># Heading, **bold**, - list, [link](url), | table |, - [ ] checklist</span>
                </div>
                {tab === "write" ? (
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "s" && (e.preventDefault(), void save())}
                    className="input min-h-[55vh] py-3 font-mono text-sm leading-relaxed"
                  />
                ) : (
                  <div className="card min-h-[55vh] p-5">{draft ? <Markdown source={draft} /> : <p className="text-sm text-slate-400">Nothing to preview.</p>}</div>
                )}
                <div className="flex gap-2">
                  <button disabled={busy} onClick={save} className="btn-primary">
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button disabled={busy} onClick={() => setEditing(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <span className="ml-auto self-center text-xs text-slate-400">Ctrl+S saves</span>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start gap-2">
                  <h1 className="flex-1 text-3xl font-extrabold tracking-tight">{titleOf(current)}</h1>
                  {canEdit && (
                    <>
                      <button onClick={() => setCreating(current.replace(/\.md$/, "/"))} className="btn-secondary h-8">
                        <Plus size={14} /> Sub-page
                      </button>
                      <button onClick={() => (setDraft(rev?.text ?? page.text), setTitle(titleOf(current)), setTab("write"), setEditing(true))} className="btn-secondary h-8">
                        <Pencil size={14} /> Edit
                      </button>
                    </>
                  )}
                  <button onClick={() => (history ? setHistory(null) : fileHistory(current).then(setHistory, (e) => setError(errorText(e))))} className="btn-secondary h-8">
                    <History size={14} /> History
                  </button>
                  {atLeast(role, "manager") && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        paths?.some((p) => p.startsWith(current.replace(/\.md$/, "/")))
                          ? setError("Delete the sub-pages first.")
                          : confirm(`Delete "${titleOf(current)}"? Its history stays on GitHub.`) &&
                            run(async () => {
                              await deletePath(current, page.sha, `Delete "${titleOf(current)}" (${me.login})`);
                              loadTree();
                              navigate(`/wiki?space=${space}`);
                            })
                      }
                      className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete page"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {history && (
                  <div className="card mb-4 divide-y divide-slate-100 text-sm">
                    {history.map((c, i) => (
                      <div key={c.sha} className={cn("flex items-center gap-3 px-3 py-2", rev?.sha === c.sha && "bg-brand-50")}>
                        <span className="flex-1 truncate">{c.commit.message}</span>
                        <span className="text-xs text-slate-500">{formatDistanceToNow(new Date(c.commit.author.date), { addSuffix: true })}</span>
                        {i === 0 ? (
                          <span className="text-xs font-semibold text-slate-500">current</span>
                        ) : (
                          <button onClick={() => readText(current, c.sha).then((r) => r && setRev({ sha: c.sha, text: r.text }))} className="text-xs font-semibold text-brand-600">
                            View
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {rev && (
                  <div className="mb-4 flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span className="flex-1">You're looking at an older version.</span>
                    {canEdit && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const sha = await writeText(current, rev.text, `Restore an older version of "${titleOf(current)}" (${me.login})`, page.sha);
                            setPage({ text: rev.text, sha });
                            setRev(null);
                            setHistory(null);
                          })
                        }
                        className="btn-primary h-8"
                      >
                        Restore this version
                      </button>
                    )}
                    <button onClick={() => setRev(null)} className="btn-secondary h-8">
                      Back to current
                    </button>
                  </div>
                )}
                {(rev?.text ?? page.text).trim() ? <Markdown source={rev?.text ?? page.text} /> : <p className="text-sm text-slate-400">This page is empty.</p>}
              </>
            )}
          </div>
        </div>
      </main>
      {creating !== null && (
        <Modal title="New page" onClose={() => setCreating(null)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const t = cleanTitle(String(new FormData(e.currentTarget).get("title")));
              const path = `${creating}${t}.md`;
              if (!t) return;
              if (paths?.includes(path)) return setError("A page with that title already exists here.");
              void run(async () => {
                await writeText(path, "", `Create "${t}" (${me.login})`);
                setCreating(null);
                loadTree();
                navigate(`/wiki?p=${encodeURIComponent(path)}`);
                setTimeout(() => (setDraft(""), setTitle(t), setEditing(true)), 50);
              });
            }}
          >
            <label className="label">
              Title
              <input name="title" required autoFocus className="input" placeholder="Onboarding guide" />
            </label>
            <ErrorNote error={error} />
            <button disabled={busy} className="btn-primary justify-center">
              Create page
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
