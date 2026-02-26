import { gcpFetch } from './GCPClient';
import type { IAMBinding } from '../types';
import { GCP_API } from './constants';

interface IAMPolicy {
  bindings?: IAMBinding[];
}

export async function getProjectIAMPolicy(projectId: string, signal?: AbortSignal): Promise<IAMBinding[]> {
  try {
    const resp = await gcpFetch<IAMPolicy>(
      `${GCP_API.IAM}/projects/${projectId}:getIamPolicy`,
      { method: 'POST', body: '{}' },
      signal,
    );
    return resp.bindings ?? [];
  } catch (err) {
    console.warn(`[discovery] IAM policy failed for ${projectId}:`, err);
    throw err;
  }
}
