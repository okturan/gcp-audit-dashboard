import { gcpFetch } from './GCPClient';
import type { ProjectServiceAccount } from '../types';
import { GCP_API } from './constants';

interface SAListResponse {
  accounts?: Array<{
    name: string;
    email: string;
    displayName?: string;
    description?: string;
    disabled?: boolean;
  }>;
  nextPageToken?: string;
}

export async function listServiceAccounts(projectId: string, signal?: AbortSignal): Promise<ProjectServiceAccount[]> {
  const all: ProjectServiceAccount[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    try {
      const resp = await gcpFetch<SAListResponse>(
        `${GCP_API.SERVICE_ACCOUNTS}/projects/${projectId}/serviceAccounts?${params}`,
        {},
        signal,
      );
      if (resp.accounts) {
        all.push(
          ...resp.accounts.map((a) => ({
            name: a.name,
            email: a.email,
            displayName: a.displayName ?? '',
            description: a.description,
            disabled: a.disabled ?? false,
            projectId,
          }))
        );
      }
      pageToken = resp.nextPageToken;
    } catch (err) {
      console.warn(`[discovery] Service accounts failed for ${projectId}:`, err);
      throw err;
    }
  } while (pageToken);

  return all;
}
