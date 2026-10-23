import { Component, StrictMode, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Shows what went wrong instead of a blank page.
class Crash extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto max-w-lg p-6 text-sm">
        <h1 className="mb-2 text-lg font-bold">Something went wrong</h1>
        <p className="mb-3 text-slate-600">Refresh the page to try again. If it keeps happening, send this message to your admin:</p>
        <pre className="whitespace-pre-wrap rounded bg-slate-100 p-3 text-xs">{this.state.error.message}</pre>
        <button onClick={() => location.reload()} className="btn-primary mt-4">
          <RefreshCw size={15} /> Refresh
        </button>
      </main>
    );
  }
}

const root = document.getElementById("root")!;
root.dataset.started = "1";
createRoot(root).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
);
