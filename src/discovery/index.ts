import { listBillingAccounts, getProjectBillingInfo } from './billing';
import { listProjects } from './projects';
import { listAPIKeys } from './apikeys';
import { listEnabledServices } from './services';
import { getProjectUsage } from './monitoring';
import { getProjectIAMPolicy } from './iam';
import { listServiceAccounts } from './serviceaccounts';
import type { BillingAccount, ProjectDiscovery } from '../types';

export interface DiscoveryResult {
  billingAccounts: BillingAccount[];
  projects: ProjectDiscovery[];
  partialFailures: number;
}

export async function discoverAll(
  onProgress?: (msg: string, done?: number, total?: number) => void,
  signal?: AbortSignal,
): Promise<DiscoveryResult> {

  onProgress?.('Fetching billing accounts and projects…');
  const [billingAccounts, projects] = await Promise.all([
    listBillingAccounts(signal),
    listProjects(signal),
  ]);

  const total = projects.length;
  onProgress?.(`Found ${billingAccounts.length} billing accounts, ${total} projects. Fetching details…`);

  let completed = 0;
  let subCallFailures = 0;
  const projectData = await Promise.allSettled(
    projects.map(async (project): Promise<ProjectDiscovery> => {
      const subCalls = await Promise.allSettled([
        getProjectBillingInfo(project.projectId, signal),
        listAPIKeys(project.projectId, signal),
        listEnabledServices(project.projectId, signal),
        getProjectUsage(project.projectId, signal),
        getProjectIAMPolicy(project.projectId, signal),
        listServiceAccounts(project.projectId, signal),
      ]);

      const [billingInfo, apiKeys, services, usage, iamBindings, serviceAccounts] = subCalls;

      // Count individual sub-call failures within this project
      subCallFailures += subCalls.filter((r) => r.status === 'rejected').length;

      completed++;
      onProgress?.(`Loading project ${completed} of ${total}… (${project.projectId})`, completed, total);

      return {
        project,
        billingInfo: billingInfo.status === 'fulfilled' ? billingInfo.value : null,
        apiKeys: apiKeys.status === 'fulfilled' ? apiKeys.value : [],
        services: services.status === 'fulfilled' ? services.value : [],
        usage: usage.status === 'fulfilled' ? usage.value : undefined,
        iamBindings: iamBindings.status === 'fulfilled' ? iamBindings.value : [],
        serviceAccounts: serviceAccounts.status === 'fulfilled' ? serviceAccounts.value : [],
      };
    })
  );

  const successfulProjects = projectData
    .filter((r): r is PromiseFulfilledResult<ProjectDiscovery> => r.status === 'fulfilled')
    .map((r) => r.value);

  // Count both whole-project failures and individual sub-call failures
  const projectFailures = projectData.filter((r) => r.status === 'rejected').length;
  const partialFailures = projectFailures + subCallFailures;

  onProgress?.(`Discovery complete — ${successfulProjects.length} projects loaded.`);

  return { billingAccounts, projects: successfulProjects, partialFailures };
}
