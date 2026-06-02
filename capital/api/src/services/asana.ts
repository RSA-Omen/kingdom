/**
 * Minimal read-only Asana client for the Guild Board.
 *
 * Phase B: only the queries the feed needs. Mirrors the Python asana_client
 * in council/lord-chamberlain/ but kept independent — the Python agent
 * writes, this service reads.
 */

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

function authHeaders(): Record<string, string> {
  const token = process.env.ASANA_API_TOKEN || '';
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

export type AsanaTag = {
  gid: string;
  name: string;
};

export type AsanaCustomFieldValue = {
  gid: string;
  name: string;
  enum_value?: { gid: string; name: string } | null;
  display_value?: string | null;
  type?: string;
};

export type AsanaTask = {
  gid: string;
  name: string;
  notes: string;
  completed?: boolean;
  created_at?: string;
  modified_at?: string;
  tags?: AsanaTag[];
  memberships?: Array<{
    project?: { gid: string; name?: string };
    section?: { gid: string; name?: string };
  }>;
  custom_fields?: AsanaCustomFieldValue[];
  assignee?: { gid: string; name?: string };
};

/**
 * Fetch all incomplete tasks from a user-task list (e.g. My Tasks → Recently
 * Assigned). Returns up to 100 (Asana max per page); pagination deferred to
 * Phase C if the list ever exceeds.
 */
export async function getMyRecentlyAssigned(
  userTaskListGid: string,
): Promise<AsanaTask[]> {
  const params = new URLSearchParams({
    completed_since: 'now',
    limit: '100',
    opt_fields: [
      'gid',
      'name',
      'notes',
      'completed',
      'created_at',
      'modified_at',
      'tags',
      'tags.gid',
      'tags.name',
      'memberships',
      'memberships.project',
      'memberships.project.gid',
      'memberships.project.name',
      'memberships.section',
      'memberships.section.gid',
      'memberships.section.name',
      'custom_fields',
      'custom_fields.gid',
      'custom_fields.name',
      'custom_fields.enum_value',
      'custom_fields.enum_value.gid',
      'custom_fields.enum_value.name',
      'custom_fields.display_value',
      'custom_fields.type',
    ].join(','),
  });

  const url = `${ASANA_BASE_URL}/user_task_lists/${userTaskListGid}/tasks?${params}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) {
    throw new Error(`Asana ${resp.status} fetching tasks: ${await resp.text()}`);
  }
  const body = (await resp.json()) as { data: AsanaTask[] };
  return body.data ?? [];
}

export type AsanaStory = {
  gid: string;
  type: 'system' | 'comment';
  resource_subtype: string;
  text: string;
  created_at: string;
  created_by?: { gid: string; name?: string };
};

export async function getTaskDetails(taskGid: string): Promise<AsanaTask> {
  const params = new URLSearchParams({
    opt_fields: [
      'gid', 'name', 'notes', 'completed', 'created_at', 'modified_at',
      'tags', 'tags.gid', 'tags.name',
      'memberships', 'memberships.project', 'memberships.project.gid',
      'memberships.project.name', 'memberships.section',
      'memberships.section.gid', 'memberships.section.name',
      'custom_fields', 'custom_fields.gid', 'custom_fields.name',
      'custom_fields.enum_value', 'custom_fields.enum_value.gid',
      'custom_fields.enum_value.name', 'custom_fields.display_value',
      'custom_fields.type', 'assignee', 'assignee.gid', 'assignee.name',
    ].join(','),
  });
  const url = `${ASANA_BASE_URL}/tasks/${taskGid}?${params}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) {
    throw new Error(`Asana ${resp.status} fetching task ${taskGid}: ${await resp.text()}`);
  }
  const body = (await resp.json()) as { data: AsanaTask };
  return body.data;
}

export async function getTaskStories(taskGid: string): Promise<AsanaStory[]> {
  const params = new URLSearchParams({
    opt_fields: 'gid,type,resource_subtype,text,created_at,created_by.name',
    limit: '100',
  });
  const url = `${ASANA_BASE_URL}/tasks/${taskGid}/stories?${params}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) {
    throw new Error(`Asana ${resp.status} fetching stories for ${taskGid}: ${await resp.text()}`);
  }
  const body = (await resp.json()) as { data: AsanaStory[] };
  return body.data ?? [];
}

/**
 * Post a comment to an Asana task. Returns the created story GID.
 */
export async function addTaskComment(taskGid: string, text: string): Promise<string> {
  const resp = await fetch(`${ASANA_BASE_URL}/tasks/${taskGid}/stories`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { text } }),
  });
  if (!resp.ok) {
    throw new Error(`Asana ${resp.status} posting comment on ${taskGid}: ${await resp.text()}`);
  }
  const body = await resp.json() as { data?: { gid?: string } };
  return body.data?.gid ?? '';
}

export type AsanaSubtask = {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
};

export type AsanaAttachment = {
  gid: string;
  name: string;
  download_url: string | null;
  view_url: string | null;
  created_at: string;
};

export async function getTaskSubtasks(taskGid: string): Promise<AsanaSubtask[]> {
  const params = new URLSearchParams({
    opt_fields: 'gid,name,completed,due_on',
    limit: '100',
  });
  const url = `${ASANA_BASE_URL}/tasks/${taskGid}/subtasks?${params}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) {
    throw new Error(`Asana ${resp.status} fetching subtasks for ${taskGid}: ${await resp.text()}`);
  }
  const body = (await resp.json()) as { data: AsanaSubtask[] };
  return body.data ?? [];
}

export async function getTaskAttachments(taskGid: string): Promise<AsanaAttachment[]> {
  const params = new URLSearchParams({
    opt_fields: 'gid,name,download_url,view_url,created_at',
    limit: '100',
  });
  const url = `${ASANA_BASE_URL}/tasks/${taskGid}/attachments?${params}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) {
    throw new Error(`Asana ${resp.status} fetching attachments for ${taskGid}: ${await resp.text()}`);
  }
  const body = (await resp.json()) as { data: AsanaAttachment[] };
  return body.data ?? [];
}

/**
 * Health-check the PAT. Returns true if 200, false on 401/403.
 * Other errors bubble up — they're not PAT problems.
 */
export async function checkPat(): Promise<boolean> {
  try {
    const resp = await fetch(`${ASANA_BASE_URL}/users/me`, {
      headers: authHeaders(),
    });
    if (resp.status === 401 || resp.status === 403) return false;
    return true;
  } catch {
    // Network errors don't indicate a bad PAT
    return true;
  }
}
