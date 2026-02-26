import { gcpFetch } from './GCPClient';
import type { GCPService } from '../types';
import { GCP_API } from './constants';

interface ServicesResponse {
  services?: GCPService[];
  nextPageToken?: string;
}

export async function listEnabledServices(projectId: string, signal?: AbortSignal): Promise<GCPService[]> {
  const all: GCPService[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ filter: 'state:ENABLED' });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${GCP_API.SERVICE_USAGE}/projects/${projectId}/services?${params}`;
    try {
      const resp = await gcpFetch<ServicesResponse>(url, {}, signal);
      if (resp.services) all.push(...resp.services.map((s) => ({ ...s, projectId })));
      pageToken = resp.nextPageToken;
    } catch (err) {
      console.warn(`[discovery] Services failed for ${projectId}:`, err);
      throw err;
    }
  } while (pageToken);

  return all;
}
