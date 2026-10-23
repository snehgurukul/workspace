import { useCallback, useEffect, useRef, useState } from "react";
import { Download, File as FileIcon, Folder, Trash2, Upload } from "lucide-react";
import { type RepoFile, listDir } from "@/lib/gh";
import { openFile, removeFile, uploadFile } from "@/lib/files";
import { useData } from "@/lib/store";
import { atLeast } from "@/lib/model";
import { errorText, fileSize } from "@/lib/utils";
import { ErrorNote } from "./ui";

export function useFolder(folder: string) {
  const [files, setFiles] = useState<RepoFile[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    listDir(folder).then(
      (f) => setFiles(f.filter((x) => x.name !== ".keep")),
      (e) => setError(errorText(e)),
    );
  }, [folder]);
  useEffect(load, [load]);
  return { files, error, reload: load, setError };
}

export function UploadButton({ folder, onDone, onError }: { folder: string; onDone: () => void; onError: (e: string) => void }) {
  const { me, role } = useData();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  if (!atLeast(role, "member")) return null;
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          const list = [...(e.target.files ?? [])];
          e.target.value = "";
          try {
            for (const f of list) {
              setBusy(f.name);
              await uploadFile(folder, f, me.login);
            }
          } catch (err) {
            onError(errorText(err));
          } finally {
            setBusy("");
            onDone();
          }
        }}
      />
      <button disabled={!!busy} onClick={() => input.current?.click()} className="btn-secondary">
        <Upload size={15} /> {busy ? `Uploading ${busy}…` : "Upload"}
      </button>
    </>
  );
}

export function FileRows({ files, onOpenFolder, onChanged, onError }: { files: RepoFile[]; onOpenFolder?: (f: RepoFile) => void; onChanged: () => void; onError: (e: string) => void }) {
  const { me, role } = useData();
  const [busy, setBusy] = useState("");
  const act = async (f: RepoFile, fn: () => Promise<unknown>) => {
    setBusy(f.path);
    try {
      await fn();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="card divide-y divide-slate-100 overflow-hidden">
      {files
        .slice()
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
        .map((f) =>
          f.type === "dir" ? (
            <button key={f.path} onClick={() => onOpenFolder?.(f)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
              <Folder size={16} className="text-brand-500" /> <span className="text-sm font-medium">{f.name}</span>
            </button>
          ) : (
            <div key={f.path} className="flex items-center gap-3 px-4 py-2.5">
              <FileIcon size={16} className="text-slate-400" />
              <button onClick={() => act(f, () => openFile(f, "open"))} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline">
                {f.name}
              </button>
              <span className="text-xs text-slate-500">{fileSize(f.size)}</span>
              <button disabled={busy === f.path} onClick={() => act(f, () => openFile(f, "download"))} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Download">
                <Download size={15} />
              </button>
              {atLeast(role, "member") && (
                <button
                  disabled={busy === f.path}
                  onClick={() => confirm(`Delete ${f.name}?`) && act(f, async () => (await removeFile(f, me.login), onChanged()))}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ),
        )}
    </div>
  );
}

export function Attachments({ folder }: { folder: string }) {
  const { files, error, reload, setError } = useFolder(folder);
  return (
    <div className="flex flex-col gap-2">
      <ErrorNote error={error} />
      {files && files.length > 0 && <FileRows files={files} onChanged={reload} onError={setError} />}
      <div>
        <UploadButton folder={folder} onDone={reload} onError={setError} />
      </div>
    </div>
  );
}
