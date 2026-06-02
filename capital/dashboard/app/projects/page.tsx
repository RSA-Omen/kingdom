"use client";
import { useEffect, useState } from "react";

const API = ""; // routes proxied via app/api/projects/

interface ProjectSummary {
  id: string;
  asana_task_gid: string;
  name: string;
  completed: boolean;
  enrolled_at: number;
  last_synced_at: number | null;
  subtask_total: number;
  subtask_done: number;
  overdue_count: number;
  attachment_count: number;
  last_comment: { created_at: number; created_by: string | null; text: string } | null;
}

function timeAgo(unixSecs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1 rounded-full bg-[var(--color-bg-subtle)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "#22c55e" : "var(--color-accent)",
          }}
        />
      </div>
      <span className="text-xs text-[var(--color-text-tertiary)] w-16 text-right">
        {done}/{total} phases
      </span>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollInput, setEnrollInput] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchProjects = () => {
    fetch(`${API}/api/projects`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  async function enroll() {
    if (!enrollInput.trim()) return;
    setEnrolling(true);
    setEnrollError(null);
    try {
      const resp = await fetch(`${API}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asana_task_url: enrollInput.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setEnrollError(data.error || "Enroll failed");
      } else {
        setEnrollInput("");
        fetchProjects();
      }
    } catch {
      setEnrollError("Network error");
    } finally {
      setEnrolling(false);
    }
  }

  const visible = projects.filter((p) => showCompleted || !p.completed);
  const activeCount = projects.filter((p) => !p.completed).length;

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          The Capital
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">
          Projects
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {activeCount} active project{activeCount !== 1 ? "s" : ""} — board initiatives tracked from Asana
        </p>
      </header>

      {/* Enroll form */}
      <div className="surface p-5 flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Enroll a project
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Paste an Asana task URL or task GID. The Kingdom will sync phases, comments, and attachments every 15 minutes.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={enrollInput}
            onChange={(e) => setEnrollInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enroll()}
            placeholder="https://app.asana.com/0/... or task GID"
            className="flex-1 text-sm border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={enroll}
            disabled={enrolling || !enrollInput.trim()}
            className="text-sm px-4 py-2 rounded bg-[var(--color-accent)] text-black font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {enrolling ? "Enrolling…" : "Enroll"}
          </button>
        </div>
        {enrollError && (
          <p className="text-xs text-red-400">{enrollError}</p>
        )}
      </div>

      {/* Filter toggle */}
      {projects.some((p) => p.completed) && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {showCompleted ? "Hide completed" : `Show ${projects.filter((p) => p.completed).length} completed`}
          </button>
        </div>
      )}

      {/* Project cards */}
      {loading ? (
        <div className="text-sm text-[var(--color-text-tertiary)] py-8 text-center">
          Loading projects…
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
          No projects enrolled — paste an Asana task URL above to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((p) => (
            <a
              key={p.id}
              href={`/projects/${p.id}`}
              className="surface block p-5 hover:border-[var(--color-accent)] transition-colors border border-transparent"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {p.name}
                    </h2>
                    {p.completed && (
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-subtle)] text-[var(--color-text-tertiary)] flex-shrink-0">
                        Complete
                      </span>
                    )}
                    {p.overdue_count > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400 flex-shrink-0">
                        {p.overdue_count} overdue
                      </span>
                    )}
                  </div>

                  {p.subtask_total > 0 && (
                    <ProgressBar done={p.subtask_done} total={p.subtask_total} />
                  )}

                  {p.last_comment && (
                    <p className="mt-2 text-xs text-[var(--color-text-tertiary)] line-clamp-1">
                      <span className="text-[var(--color-text-secondary)]">
                        {p.last_comment.created_by || "Someone"}
                      </span>
                      {" · "}
                      {p.last_comment.text}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-[var(--color-text-tertiary)]">
                  {p.last_synced_at && (
                    <span>synced {timeAgo(p.last_synced_at)}</span>
                  )}
                  {p.attachment_count > 0 && (
                    <span>{p.attachment_count} file{p.attachment_count !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
