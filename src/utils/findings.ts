import type { BillingAccount, ProjectDiscovery } from '../types';
import { projectNodeId, apiKeyNodeId, billingNodeId } from '../graph/builder';

export type Severity = 'red' | 'yellow' | 'green';

export interface Finding {
  severity: Severity;
  nodeId: string;
  title: string;
  body: string;
}

export const SEV_ORDER: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };

export function computeFindings(
  billingAccounts: BillingAccount[],
  rawProjects: ProjectDiscovery[],
): Finding[] {
  const findings: Finding[] = [];

  for (const pd of rawProjects) {
    const projName = pd.project.displayName || pd.project.projectId;
    const projNid = projectNodeId(pd.project.projectId);

    // Unrestricted API keys
    for (const key of pd.apiKeys) {
      const r = key.restrictions;
      const isUnrestricted =
        !r || (!r.apiTargets?.length && !r.browserKeyRestrictions && !r.serverKeyRestrictions);
      if (isUnrestricted) {
        findings.push({
          severity: 'red',
          nodeId: apiKeyNodeId(key.uid || key.name),
          title: `Unrestricted key: ${key.displayName || key.uid.slice(0, 12)}`,
          body: `${projName} — add API target or IP restrictions immediately`,
        });
      }
    }

    // Old API keys
    for (const key of pd.apiKeys) {
      const ageDays = key.createTime
        ? Math.floor((Date.now() - new Date(key.createTime).getTime()) / 86_400_000)
        : undefined;
      if (ageDays === undefined) continue;
      if (ageDays > 180) {
        findings.push({
          severity: 'red',
          nodeId: apiKeyNodeId(key.uid || key.name),
          title: `Key ${ageDays}d old: ${key.displayName || key.uid.slice(0, 12)}`,
          body: `${projName} — rotate this key (over 180 days old)`,
        });
      } else if (ageDays > 90) {
        findings.push({
          severity: 'yellow',
          nodeId: apiKeyNodeId(key.uid || key.name),
          title: `Key ${ageDays}d old: ${key.displayName || key.uid.slice(0, 12)}`,
          body: `${projName} — schedule rotation (over 90 days old)`,
        });
      }
    }

    // Deleted principal references in IAM
    const deletedRefs =
      pd.iamBindings?.flatMap((b) => b.members.filter((m) => m.startsWith('deleted:'))) ?? [];
    if (deletedRefs.length > 0) {
      findings.push({
        severity: 'red',
        nodeId: projNid,
        title: `Stale IAM: ${deletedRefs.length} deleted principal(s)`,
        body: `${projName} — clean up deleted: entries from IAM policy`,
      });
    }

    // allUsers / allAuthenticatedUsers in IAM
    const hasPublic =
      pd.iamBindings?.some((b) =>
        b.members.some((m) => m === 'allUsers' || m === 'allAuthenticatedUsers')
      ) ?? false;
    if (hasPublic) {
      findings.push({
        severity: 'red',
        nodeId: projNid,
        title: `Public IAM binding`,
        body: `${projName} — allUsers or allAuthenticatedUsers has a role`,
      });
    }

    // Billing disabled + many services (zombie project)
    if (!pd.billingInfo?.billingEnabled && pd.services.length > 5) {
      findings.push({
        severity: 'yellow',
        nodeId: projNid,
        title: `Zombie: ${pd.services.length} services, billing off`,
        body: `${projName} — disable unused services or re-attach billing`,
      });
    }

    // Service accounts with owner/admin roles
    const saEmails = new Set((pd.serviceAccounts ?? []).map((sa) => sa.email));
    for (const binding of pd.iamBindings ?? []) {
      if (/owner|admin/i.test(binding.role)) {
        const saMembersWithAdmin = binding.members.filter(
          (m) => m.startsWith('serviceAccount:') && saEmails.has(m.replace('serviceAccount:', ''))
        );
        for (const m of saMembersWithAdmin) {
          findings.push({
            severity: 'yellow',
            nodeId: projNid,
            title: `SA has ${binding.role.split('/').pop()}`,
            body: `${projName} — ${m.replace('serviceAccount:', '')} has elevated privileges`,
          });
        }
      }
    }

    // Disabled SAs still referenced in IAM
    const disabledSAs = new Set(
      (pd.serviceAccounts ?? []).filter((sa) => sa.disabled).map((sa) => `serviceAccount:${sa.email}`)
    );
    if (disabledSAs.size > 0) {
      for (const binding of pd.iamBindings ?? []) {
        const ghostMembers = binding.members.filter((m) => disabledSAs.has(m));
        for (const m of ghostMembers) {
          findings.push({
            severity: 'yellow',
            nodeId: projNid,
            title: `Disabled SA in IAM`,
            body: `${projName} — ${m.replace('serviceAccount:', '')} is disabled but has role ${binding.role.split('/').pop()}`,
          });
        }
      }
    }
  }

  // Closed billing account still linked to projects
  for (const ba of billingAccounts) {
    if (!ba.open) {
      const linked = rawProjects.filter(
        (pd) => pd.billingInfo?.billingAccountName === ba.name
      );
      if (linked.length > 0) {
        findings.push({
          severity: 'yellow',
          nodeId: billingNodeId(ba),
          title: `Closed billing, ${linked.length} linked project(s)`,
          body: `${ba.displayName} — projects may fail if billing is required`,
        });
      }
    }
  }

  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  return findings;
}
