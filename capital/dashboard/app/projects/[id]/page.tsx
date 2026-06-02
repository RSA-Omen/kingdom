"use client";
import { useEffect, useState, use } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface Subtask {
  id: string;
  asana_gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  sort_order: number;
}

interface Comment {
  id: string;
  asana_gid: string;
  created_at: number;
  created_by: string | null;
  text: string;
}

interface Attachment {
  id: string;
  asana_gid: string;
  name: string;
  download_url: string | null;
  view_url: string | null;
  created_at: number;
}

interface Project {
  id: string;
  asana_task_gid: string;
  name: string;
  notes: string | null;
  completed: boolean;
  enrolled_at: number;
  last_synced_at: number | null;
  subtasks: Subtask[];
  comments: Comment[];
  attachments: Attachment[];
}

function formatDate(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TODAY = new Date().toISOString().split("T")[0];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = () => {
    fetch(`${API}/api/projects/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setProject(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProject(); }, [id]);

  async function syncNow() {
    setSyncing(true);
    await fetch(`${API}/api/projects/${id}/sync`, { method: "POST" });
    setSyncing(false);
    fetchProject();
  }

  async function unenroll() {
    if (!confirm(`Unenroll "${project?.name}"? This removes it from the Kingdom (Asana task is unaffected).`)) return;
    setDeleting(true);
    await fetch(`${API}/api/projects/${id}`, { method: "DELETE" });
    window.location.href = "/projects";
  }

  if (loading) {
    return (
      <div className="text-sm text-[var(--color-text-tertiary)] py-16 text-center">
        Loading…
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-text-tertiary)]">Project not found.</p>
        <a href="/projects" className="text-xs text-[var(--color-accent)] mt-2 inline-block">
          ← Back to Projects
        </a>
      </div>
    );
  }

  const done = project.subtasks.filter((s) => s.completed).length;
  const total = project.subtasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const overdue = project.subtasks.filter(
    (s) => !s.completed && s.due_on && s.due_on < TODAY
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <a
          href="/projects"
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors"
        >
          ← Projects
        </a>
        <div className="flex items-start justify-between mt-3 gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
              The Capital · Projects
            </p>
            <h1 className="text-2xl font-semibold mt-1 text-[var(--color-text-primary)]">
              {project.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-tertiary)]">
              <span>Enrolled {formatDate(project.enrolled_at)}</span>
              {project.last_synced_at && (
                <span>· Synced {formatDateTime(project.last_synced_at)}</span>
              )}
              <a
                href={`https://app.asana.com/0/0/${project.asana_task_gid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:opacity-80 transition-opacity"
              >
                Open in Asana ↗
              </a>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-40"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={unenroll}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              Unenroll
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      {project.notes && (
        <div className="surface p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium mb-3">
            Brief
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {project.notes}
          </p>
        </div>
      )}

      {/* Phases / Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
            Phases
          </p>
          {total > 0 && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {done}/{total} · {pct}%
            </span>
          )}
        </div>

        {total > 0 && (
          <div className="h-1 rounded-full bg-[var(--color-bg-subtle)] overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? "#22c55e" : "var(--color-accent)",
              }}
            />
          </div>
        )}

        {overdue.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded bg-red-900/20 border border-red-800/30 text-xs text-red-400">
            {overdue.length} overdue phase{overdue.length !== 1 ? "s" : ""}:{" "}
            {overdue.map((s) => s.name).join(", ")}
          </div>
        )}

        {total === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No subtasks on this task yet.
          </p>
        ) : (
          <div className="space-y-1">
            {project.subtasks.map((s) => (
              <div
                key={s.id}
                className="surface flex items-center gap-3 px-4 py-3"
              >
                <div
                  className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                    s.completed
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  {s.completed && (
                    <svg
                      className="w-2.5 h-2.5 text-black"
                      fill="none"
                      viewBox="0 0 10 8"
                    >
                      <path
                        d="M1 4l3 3 5-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`flex-1 text-sm ${
                    s.completed
                      ? "line-through text-[var(--color-text-tertiary)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {s.name}
                </span>
                {s.due_on && !s.completed && (
                  <span
                    className={`text-xs flex-shrink-0 ${
                      s.due_on < TODAY ? "text-red-400" : "text-[var(--color-text-tertiary)]"
                    }`}
                  >
                    {s.due_on}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      {project.attachments.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium mb-3">
            Attachments ({project.attachments.length})
          </p>
          <div className="space-y-1">
            {project.attachments.map((a) => (
              <div key={a.id} className="surface flex items-center gap-3 px-4 py-3">
                <span className="text-[var(--color-text-tertiary)] flex-shrink-0">📎</span>
                <span className="flex-1 text-sm text-[var(--color-text-secondary)] truncate">
                  {a.name}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                  {formatDate(a.created_at)}
                </span>
                {(a.view_url || a.download_url) && (
                  <a
                    href={(a.view_url || a.download_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-accent)] hover:opacity-80 transition-opacity flex-shrink-0"
                  >
                    Open ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium mb-3">
          Commentary ({project.comments.length})
        </p>
        {project.comments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">No comments yet.</p>
        ) : (
          <div className="space-y-3">
            {project.comments.map((c) => (
              <div key={c.id} className="surface px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">
                    {c.created_by || "Unknown"}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {formatDateTime(c.created_at)}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
