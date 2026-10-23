import { deletePath, fileToBase64, listDir, readBlob, writeBase64, type RepoFile } from "./gh";

// Uploaded files sit under files/ on the data branch. GitHub's API accepts files up to about 50 MB this way.
export const MAX_UPLOAD = 50 * 1024 * 1024;

export async function uploadFile(folder: string, file: File, who: string): Promise<void> {
  if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is bigger than 50 MB.`);
  const safe = file.name.replace(/[\\/:*?"<>|#%]+/g, "-");
  const existing = new Set((await listDir(folder)).map((f) => f.name));
  let name = safe;
  for (let i = 2; existing.has(name); i++) name = safe.replace(/(\.[^.]*)?$/, ` (${i})$1`);
  await writeBase64(`${folder}/${name}`, await fileToBase64(file), `Upload ${name} (${who})`);
}

export async function openFile(f: RepoFile, mode: "open" | "download") {
  const url = URL.createObjectURL(await readBlob(f.path));
  if (mode === "open") window.open(url, "_blank");
  else {
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const removeFile = (f: RepoFile, who: string) => deletePath(f.path, f.sha, `Delete ${f.name} (${who})`);
