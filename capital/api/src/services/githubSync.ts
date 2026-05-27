import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { db } from '../models/database';

const execFileP = promisify(execFile);

interface RepoConfig {
  village: string;
  owner: string;
  repo: string;
}

interface ReposConfigFile {
  repos: RepoConfig[];
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'OPEN' | 'CLOSED';
  url: string;
}

export interface SyncResult {
  repos_synced: number;
  issues_imported: number;
  issues_updated: number;
  issues_closed: number;
  errors: string[];
  duration_ms: number;
}

class GitHubSyncService {
  private readonly REPOS_CONFIG_PATH = join(
    process.cwd(),
    '..',
    'data',
    'github-repos.json'
  );

  loadRepos(): RepoConfig[] {
    if (!existsSync(this.REPOS_CONFIG_PATH)) {
      console.warn(`[GitHubSync] No repos config at ${this.REPOS_CONFIG_PATH}`);
      return [];
    }
    const raw = readFileSync(this.REPOS_CONFIG_PATH, 'utf-8');
    const parsed: ReposConfigFile = JSON.parse(raw);
    return parsed.repos || [];
  }

  private async fetchIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
    // gh issue list returns open issues by default; --state all returns both
    // Using --state all so we can also close todos when issues are closed on GitHub
    const { stdout } = await execFileP('gh', [
      'issue',
      'list',
      '-R',
      `${owner}/${repo}`,
      '--state',
      'all',
      '--limit',
      '200',
      '--json',
      'number,title,body,state,url',
    ], { maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(stdout) as GitHubIssue[];
  }

  private upsertIssue(repoCfg: RepoConfig, issue: GitHubIssue): 'imported' | 'updated' | 'closed' | 'noop' {
    const source = `github:${repoCfg.owner}/${repoCfg.repo}#${issue.number}`;
    const dbInstance = (db as any).getDb();
    const existing = dbInstance.prepare('SELECT id, status FROM todos WHERE source = ?').get(source) as { id: string; status: string } | undefined;
    const issueState = issue.state.toLowerCase();

    if (existing) {
      if (issueState === 'closed' && existing.status !== 'done') {
        // Issue was closed on GitHub — mark todo done
        dbInstance.prepare(
          'UPDATE todos SET title = ?, description = ?, external_url = ?, external_state = ?, status = ? WHERE id = ?'
        ).run(issue.title, issue.body || null, issue.url, issueState, 'done', existing.id);
        return 'closed';
      }
      // Update title/description/url in case they changed; preserve local status
      dbInstance.prepare(
        'UPDATE todos SET title = ?, description = ?, external_url = ?, external_state = ? WHERE id = ?'
      ).run(issue.title, issue.body || null, issue.url, issueState, existing.id);
      return 'updated';
    }

    // Skip importing already-closed issues we've never seen
    if (issueState === 'closed') return 'noop';

    const id = randomUUID();
    dbInstance.prepare(
      `INSERT INTO todos (id, village, title, description, source, status, created_at, external_url, external_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      repoCfg.village,
      issue.title,
      issue.body || null,
      source,
      'open',
      Math.floor(Date.now() / 1000),
      issue.url,
      issueState
    );
    return 'imported';
  }

  async sync(trigger: 'manual' | 'scheduled' = 'manual'): Promise<SyncResult> {
    const startedAt = Math.floor(Date.now() / 1000);
    const t0 = Date.now();
    const dbInstance = (db as any).getDb();

    const runInsert = dbInstance.prepare(
      'INSERT INTO github_sync_runs (started_at, trigger) VALUES (?, ?)'
    ).run(startedAt, trigger);
    const runId = runInsert.lastInsertRowid as number;

    const repos = this.loadRepos();
    const result: SyncResult = {
      repos_synced: 0,
      issues_imported: 0,
      issues_updated: 0,
      issues_closed: 0,
      errors: [],
      duration_ms: 0,
    };

    for (const repo of repos) {
      try {
        const issues = await this.fetchIssues(repo.owner, repo.repo);
        for (const issue of issues) {
          const outcome = this.upsertIssue(repo, issue);
          if (outcome === 'imported') result.issues_imported++;
          else if (outcome === 'updated') result.issues_updated++;
          else if (outcome === 'closed') result.issues_closed++;
        }
        result.repos_synced++;
      } catch (e: any) {
        const msg = `${repo.owner}/${repo.repo}: ${e.message || String(e)}`;
        console.error(`[GitHubSync] ${msg}`);
        result.errors.push(msg);
      }
    }

    result.duration_ms = Date.now() - t0;

    dbInstance.prepare(
      `UPDATE github_sync_runs
       SET finished_at = ?, repos_synced = ?, issues_imported = ?, issues_updated = ?, issues_closed = ?, error_message = ?
       WHERE id = ?`
    ).run(
      Math.floor(Date.now() / 1000),
      result.repos_synced,
      result.issues_imported,
      result.issues_updated,
      result.issues_closed,
      result.errors.length ? result.errors.join('; ') : null,
      runId
    );

    console.log(
      `[GitHubSync] ${trigger} sync done in ${result.duration_ms}ms — ${result.repos_synced} repos, +${result.issues_imported} new, ~${result.issues_updated} updated, x${result.issues_closed} closed${result.errors.length ? `, ${result.errors.length} errors` : ''}`
    );

    return result;
  }

  getLastRun(): any {
    const dbInstance = (db as any).getDb();
    return dbInstance.prepare(
      'SELECT * FROM github_sync_runs ORDER BY started_at DESC LIMIT 1'
    ).get();
  }
}

export const githubSyncService = new GitHubSyncService();
