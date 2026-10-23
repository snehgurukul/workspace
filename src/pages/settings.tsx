import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { OWNER, REPO } from "@/lib/gh";
import { useData } from "@/lib/store";
import { atLeast } from "@/lib/model";
import { download } from "@/lib/utils";
import { Avatar, PageHeader } from "@/components/ui";

export function Settings() {
  const { me, role, tasks, config, sprints, members, signOut } = useData();
  const [copied, setCopied] = useState(false);
  const repoUrl = `https://github.com/${OWNER}/${REPO}`;
  const csv = () => {
    const rows = [["Number", "Project", "Title", "Type", "Status", "Priority", "Assignees", "Due", "Estimate", "Sprint", "Release", "Open", "Created"]].concat(
      tasks.map((t) => [
        String(t.number),
        t.project,
        t.title,
        t.type,
        t.status,
        t.priority,
        t.assignees.join(" "),
        t.meta.due ?? "",
        String(t.meta.estimate ?? ""),
        sprints.find((s) => s.number === t.milestone)?.name ?? "",
        t.release,
        t.open ? "yes" : "no",
        t.createdAt.slice(0, 10),
      ]),
    );
    download("sneh-workspace-tasks.csv", rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };
  return (
    <>
      <PageHeader title="Settings" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <section className="card flex items-center gap-4 p-5">
          <Avatar login={me.login} url={me.avatar_url} size={48} />
          <div className="flex-1">
            <p className="font-bold">{me.name || me.login}</p>
            <p className="text-sm capitalize text-slate-500">
              @{me.login} · {role}
            </p>
          </div>
          <a href="https://github.com/settings/profile" target="_blank" rel="noreferrer" className="btn-secondary">
            Edit on GitHub <ExternalLink size={13} />
          </a>
          <button onClick={signOut} className="btn-secondary">
            Sign out
          </button>
        </section>

        <section className="card flex flex-col gap-2 p-5">
          <h2 className="font-bold">Email and phone notifications</h2>
          <p className="text-sm text-slate-600">
            GitHub sends you an email when you're assigned a task or someone @mentions you. Choose how you get them in{" "}
            <a className="font-semibold text-brand-600 underline" href="https://github.com/settings/notifications" target="_blank" rel="noreferrer">
              GitHub notification settings
            </a>
            . The free GitHub Mobile app gives you phone alerts too.
          </p>
        </section>

        <section className="card flex flex-col gap-2 p-5">
          <h2 className="font-bold">Calendar</h2>
          <p className="text-sm text-slate-600">Open the Calendar page and click Export .ics, then open the file in Outlook or Google Calendar to add due dates, sprints and releases.</p>
        </section>

        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-bold">Export</h2>
          <p className="text-sm text-slate-600">Everything also lives in GitHub itself: tasks are issues and docs and files are on the workspace-data branch.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={csv} className="btn-secondary">
              Tasks as CSV
            </button>
            {atLeast(role, "admin") && (
              <button onClick={() => download("sneh-workspace-backup.json", JSON.stringify({ exportedAt: new Date().toISOString(), config, sprints, members, tasks }, null, 2), "application/json")} className="btn-secondary">
                Full backup (JSON)
              </button>
            )}
            <a href={repoUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              Open repository <ExternalLink size={13} />
            </a>
          </div>
        </section>

        {atLeast(role, "admin") && (
          <section className="card flex flex-col gap-2 p-5">
            <h2 className="font-bold">Team chat alerts</h2>
            <p className="text-sm text-slate-600">
              To post new tasks and comments to Microsoft Teams, Google Chat or Slack, add a repository secret named <code className="rounded bg-slate-100 px-1">ALERTS_WEBHOOK_URL</code> holding your chat's incoming webhook address. Alerts start straight away.
            </p>
            <button
              onClick={() => {
                void navigator.clipboard.writeText("ALERTS_WEBHOOK_URL");
                setCopied(true);
              }}
              className="btn-secondary self-start"
            >
              {copied ? "Copied" : "Copy the secret name"}
            </button>
            <a href={`${repoUrl}/settings/secrets/actions/new`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 underline">
              Open repository secrets
            </a>
          </section>
        )}
      </main>
    </>
  );
}
