import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { WorkspaceProvider, useWs } from "@/lib/store";
import { Layout } from "@/components/layout";
import { Spinner } from "@/components/ui";
import { Login } from "@/pages/login";
import { Home } from "@/pages/home";
import { MyTasks } from "@/pages/my-tasks";
import { Projects } from "@/pages/projects";
import { Board } from "@/pages/board";
import { TaskList } from "@/pages/task-list";
import { ProjectSettings } from "@/pages/project-settings";
import { TaskPage } from "@/pages/task";
import { Sprints } from "@/pages/sprints";
import { Releases } from "@/pages/releases";
import { Bugs } from "@/pages/bugs";
import { Qa } from "@/pages/qa";
import { Calendar } from "@/pages/calendar";
import { Wiki } from "@/pages/wiki";
import { Files } from "@/pages/files";
import { Whiteboards, WhiteboardCanvas } from "@/pages/whiteboard";
import { Activity } from "@/pages/activity";
import { Team } from "@/pages/team";
import { Search } from "@/pages/search";
import { Settings } from "@/pages/settings";
import { InboxPage } from "@/pages/inbox";
import { Timeline } from "@/pages/timeline";
import { Join } from "@/pages/join";

function Gate() {
  const ws = useWs();
  const location = useLocation();
  if (location.pathname.startsWith("/join/"))
    return (
      <Routes>
        <Route path="join/:link" element={<Join />} />
      </Routes>
    );
  if (ws.loading && !ws.state) return <Spinner label="Opening your workspace…" />;
  if (!ws.state) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="my-tasks" element={<MyTasks />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:key" element={<Navigate to="board" replace />} />
        <Route path="projects/:key/board" element={<Board />} />
        <Route path="projects/:key/list" element={<TaskList />} />
        <Route path="projects/:key/settings" element={<ProjectSettings />} />
        <Route path="tasks/:number" element={<TaskPage />} />
        <Route path="sprints" element={<Sprints />} />
        <Route path="releases" element={<Releases />} />
        <Route path="bugs" element={<Bugs />} />
        <Route path="qa" element={<Qa />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="wiki" element={<Wiki />} />
        <Route path="wiki/:slug" element={<Wiki />} />
        <Route path="files" element={<Files />} />
        <Route path="whiteboard" element={<Whiteboards />} />
        <Route path="whiteboard/:id" element={<WhiteboardCanvas />} />
        <Route path="activity" element={<Activity />} />
        <Route path="team" element={<Team />} />
        <Route path="search" element={<Search />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <WorkspaceProvider>
        <Gate />
      </WorkspaceProvider>
    </HashRouter>
  );
}
