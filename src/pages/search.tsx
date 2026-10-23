import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileText, File as FileIcon } from "lucide-react";
import { dataTree } from "@/lib/gh";
import { useData } from "@/lib/store";
import { Empty, PageHeader } from "@/components/ui";
import { TaskRow } from "@/components/task-bits";

export function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const { tasks } = useData();
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    dataTree().then((t) => setPaths(t.filter((x) => x.type === "blob").map((x) => x.path)), () => setPaths([]));
  }, []);
  const n = Number(q.replace(/^#|^[a-z][a-z0-9]*-/, ""));
  const taskHits = q ? tasks.filter((t) => t.number === n || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)).slice(0, 50) : [];
  const name = (p: string) => p.split("/").pop()!.toLowerCase();
  const pageHits = q ? paths.filter((p) => p.startsWith("wiki/") && name(p).includes(q)) : [];
  const fileHits = q ? paths.filter((p) => p.startsWith("files/") && !p.endsWith(".keep") && name(p).includes(q)) : [];
  return (
    <>
      <PageHeader title={`Search: ${params.get("q") ?? ""}`} />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        {!taskHits.length && !pageHits.length && !fileHits.length && <Empty>Nothing found.</Empty>}
        {taskHits.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Tasks</h2>
            <div className="card overflow-hidden">
              {taskHits.map((t) => (
                <TaskRow key={t.number} task={t} showProject />
              ))}
            </div>
          </section>
        )}
        {pageHits.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Wiki pages</h2>
            <div className="card divide-y divide-slate-100">
              {pageHits.map((p) => (
                <Link key={p} to={`/wiki?p=${encodeURIComponent(p)}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50">
                  <FileText size={15} className="text-slate-400" /> {p.split("/").pop()!.replace(/\.md$/, "")}
                  <span className="ml-auto text-xs text-slate-500">{p.split("/")[1]}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {fileHits.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Files</h2>
            <div className="card divide-y divide-slate-100">
              {fileHits.map((p) => (
                <Link key={p} to="/files" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50">
                  <FileIcon size={15} className="text-slate-400" /> {p.split("/").pop()}
                  <span className="ml-auto truncate text-xs text-slate-500">{p.split("/").slice(0, -1).join("/")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
