import { gcpFetch } from './GCPClient';
import type { GCPProject } from '../types';
import { MAX_PAGES, GCP_API } from './constants';

// v1 API response shape (different field names from v3)
interface ProjectV1 {
  projectNumber: string;
  projectId: string;
  lifecycleState: string;
  name: string; // display name in v1
  createTime: string;
  parent?: { type: string; id: string };
  labels?: Record<string, string>;
}

interface ProjectsV1Response {
  projects?: ProjectV1[];
  nextPageToken?: string;
}

export async function listProjects(signal?: AbortSignal): Promise<GCPProject[]> {
  const all: GCPProject[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${GCP_API.RESOURCE_MANAGER}/projects${params.size ? `?${params}` : ''}`;
    const resp = await gcpFetch<ProjectsV1Response>(url, {}, signal);

    for (const p of resp.projects ?? []) {
      all.push({
        name: `projects/${p.projectNumber}`,
        parent: p.parent ? `${p.parent.type}s/${p.parent.id}` : '',
        projectId: p.projectId,
        state: p.lifecycleState,
        displayName: p.name,
        createTime: p.createTime,
        updateTime: '', // v1 API doesn't expose updateTime
        etag: '',
        labels: p.labels,
      });
    }

    pageToken = resp.nextPageToken;
    page++;
    if (page >= MAX_PAGES) {
      console.warn('Pagination limit reached for projects');
      break;
    }
  } while (pageToken);

  return all.filter((p) => p.state === 'ACTIVE');
}
