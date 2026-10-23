import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { writeText } from "@/lib/gh";
import { useData } from "@/lib/store";
import { atLeast } from "@/lib/model";
import { errorText } from "@/lib/utils";
import { Empty, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { FileRows, UploadButton, useFolder } from "@/components/file-list";

export function Files() {
  const { role, me } = useData();
  const [folder, setFolder] = useState("files");
  const { files, error, reload, setError } = useFolder(folder);
  const parts = folder.split("/");
  return (
    <>
      <PageHeader title="Files">
        {atLeast(role, "member") && (
          <>
            <button
              onClick={async () => {
                const name = prompt("Folder name")?.replace(/[\\/:*?"<>|#%]+/g, "-").trim();
                if (!name) return;
                try {
                  await writeText(`${folder}/${name}/.keep`, "", `Create folder ${name} (${me.login})`);
                  setFolder(`${folder}/${name}`);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
              className="btn-secondary"
            >
              <FolderPlus size={15} /> New folder
            </button>
            <UploadButton folder={folder} onDone={reload} onError={setError} />
          </>
        )}
      </PageHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-6">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {parts.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-400">/</span>}
              <button onClick={() => setFolder(parts.slice(0, i + 1).join("/"))} className={i === parts.length - 1 ? "font-bold" : "text-brand-600 hover:underline"}>
                {i === 0 ? "All files" : p === "tasks" && i === 1 ? "Task attachments" : p}
              </button>
            </span>
          ))}
        </nav>
        <ErrorNote error={error} />
        {files === null ? (
          <Spinner />
        ) : files.length ? (
          <FileRows files={files} onOpenFolder={(f) => setFolder(f.path)} onChanged={reload} onError={setError} />
        ) : (
          <Empty>This folder is empty. Files you upload are stored privately in the workspace's GitHub repository (up to 50 MB each).</Empty>
        )}
      </main>
    </>
  );
}
