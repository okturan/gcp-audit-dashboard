import { gcpFetch } from './GCPClient';
import type { BillingAccount, ProjectBillingInfo } from '../types';
import { MAX_PAGES, GCP_API } from './constants';

interface BillingAccountsResponse {
  billingAccounts?: BillingAccount[];
  nextPageToken?: string;
}

export async function listBillingAccounts(signal?: AbortSignal): Promise<BillingAccount[]> {
  const all: BillingAccount[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${GCP_API.BILLING}/billingAccounts${params.size ? `?${params}` : ''}`;
    const resp = await gcpFetch<BillingAccountsResponse>(url, {}, signal);
    if (resp.billingAccounts) all.push(...resp.billingAccounts);
    pageToken = resp.nextPageToken;
    page++;
    if (page >= MAX_PAGES) {
      console.warn('Pagination limit reached for billingAccounts');
      break;
    }
  } while (pageToken);

  return all;
}

export async function getProjectBillingInfo(projectId: string, signal?: AbortSignal): Promise<ProjectBillingInfo | null> {
  try {
    return await gcpFetch<ProjectBillingInfo>(
      `${GCP_API.BILLING}/projects/${projectId}/billingInfo`,
      {},
      signal,
    );
  } catch (err) {
    console.warn(`[discovery] Billing info failed for ${projectId}:`, err);
    throw err;
  }
}
