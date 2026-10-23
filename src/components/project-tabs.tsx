import { NavLink, useParams } from "react-router-dom";
import { Settings } from "lucide-react";
import { useData } from "@/lib/store";
import { atLeast } from "@/lib/model";
import { cn } from "@/lib/utils";
import { PageHeader } from "./ui";
import { NewTaskButton } from "./task-bits";

export function useProject() {
  const { key = "" } = useParams();
  const { config } = useData();
  return config.projects.find((p) => p.key === key.toUpperCase());
}

export function ProjectHeader() {
  const project = useProject()!;
  const { role } = useData();
  const tab = ({ isActive }: { isActive: boolean }) => cn("rounded-lg px-3 py-1.5 text-sm font-semibold", isActive ? "bg-slate-100 text-ink" : "text-slate-500 hover:text-ink");
  return (
    <PageHeader title={project.name} crumb={`Projects / ${project.key}`}>
      <nav className="flex gap-1">
        <NavLink to={`/projects/${project.key}/board`} className={tab}>
          Board
        </NavLink>
        <NavLink to={`/projects/${project.key}/list`} className={tab}>
          List
        </NavLink>
        <NavLink to={`/timeline?project=${project.key}`} className={tab}>
          Timeline
        </NavLink>
        {atLeast(role, "manager") && (
          <NavLink to={`/projects/${project.key}/settings`} className={tab} title="Project settings">
            <Settings size={16} />
          </NavLink>
        )}
      </nav>
      <NewTaskButton defaults={{ project: project.key }} />
    </PageHeader>
  );
}
