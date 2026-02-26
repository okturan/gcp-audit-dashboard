import { gcpFetch } from './GCPClient';
import type { APIKey } from '../types';
import { MAX_PAGES, GCP_API } from './constants';

interface APIKeysResponse {
  keys?: APIKey[];
  nextPageToken?: string;
}

export async function listAPIKeys(projectId: string, signal?: AbortSignal): Promise<APIKey[]> {
  const all: APIKey[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${GCP_API.API_KEYS}/projects/${projectId}/locations/global/keys${params.size ? `?${params}` : ''}`;
    try {
      const resp = await gcpFetch<APIKeysResponse>(url, {}, signal);
      if (resp.keys) all.push(...resp.keys.map((k) => ({ ...k, projectId })));
      pageToken = resp.nextPageToken;
    } catch (err) {
      console.warn(`[discovery] API keys failed for ${projectId}:`, err);
      throw err;
    }
    page++;
    if (page >= MAX_PAGES) {
      console.warn('Pagination limit reached for apiKeys');
      break;
    }
  } while (pageToken);

  return all;
}
