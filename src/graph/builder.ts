import type {
  BillingAccount,
  ProjectDiscovery,
  AppNode,
  AppEdge,
  BillingAccountNodeType,
  ProjectNodeType,
  APIKeyNodeType,
  InsightsMap,
} from '../types';
import { applyTreeLayout } from './layout';

// ── ID helpers ────────────────────────────────────────────────────────────────
export const billingNodeId = (ba: BillingAccount) => `billing-${ba.name.split('/')[1]}`;
export const projectNodeId = (projectId: string) => `project-${projectId}`;
export const apiKeyNodeId = (uid: string) => `apikey-${uid}`;

// ── Build graph ────────────────────────────────────────────────────────────────
export function buildGraph(
  billingAccounts: BillingAccount[],
  projectData: ProjectDiscovery[],
  insights: InsightsMap = {}
): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [];
  const edges: AppEdge[] = [];
  const projectsPerBillingAccount = new Map<string, number>();

  for (const { billingInfo } of projectData) {
    const billingAccountName = billingInfo?.billingEnabled ? billingInfo.billingAccountName : undefined;
    if (!billingAccountName) continue;
    projectsPerBillingAccount.set(
      billingAccountName,
      (projectsPerBillingAccount.get(billingAccountName) ?? 0) + 1
    );
  }

  // Billing account nodes
  for (const ba of billingAccounts) {
    const id = billingNodeId(ba);
    const node: BillingAccountNodeType = {
      id,
      type: 'billingAccount',
      position: { x: 0, y: 0 },
      data: {
        billingAccount: ba,
        projectCount: projectsPerBillingAccount.get(ba.name) ?? 0,
        insight: insights[id],
      },
    };
    nodes.push(node);
  }

  // Project + children
  for (const { project, billingInfo, apiKeys, services, usage, iamBindings, serviceAccounts } of projectData) {
    const pid = project.projectId;
    const projId = projectNodeId(pid);
    const projNode: ProjectNodeType = {
      id: projId,
      type: 'project',
      position: { x: 0, y: 0 },
      data: {
        project,
        billingInfo,
        apiKeyCount: apiKeys.length,
        serviceCount: services.length,
        services,
        usage,
        iamBindings,
        serviceAccounts,
        insight: insights[projId],
      },
    };
    nodes.push(projNode);

    // Billing → Project edge
    if (billingInfo?.billingEnabled && billingInfo.billingAccountName) {
      const baId = `billing-${billingInfo.billingAccountName.split('/')[1]}`;
      edges.push({
        id: `e-${baId}-${projId}`,
        source: baId,
        target: projId,
        animated: false,
      });
    }

    // API Key nodes
    for (const key of apiKeys) {
      // Fall back to key.name if uid is missing to avoid ID collisions
      const safeId = key.uid || key.name;
      const keyId = apiKeyNodeId(safeId);
      const keyNode: APIKeyNodeType = {
        id: keyId,
        type: 'apiKey',
        position: { x: 0, y: 0 },
        data: { apiKey: key, projectId: pid, insight: insights[keyId] },
      };
      nodes.push(keyNode);
      edges.push({ id: `e-${projId}-${keyId}`, source: projId, target: keyId });
    }
  }

  // Deduplicate nodes and edges by ID — React Flow silently breaks with duplicates
  const seenNodes = new Set<string>();
  const uniqueNodes = nodes.filter((n) => { if (seenNodes.has(n.id)) return false; seenNodes.add(n.id); return true; });
  const seenEdges = new Set<string>();
  const uniqueEdges = edges.filter((e) => { if (seenEdges.has(e.id)) return false; seenEdges.add(e.id); return true; });

  return { nodes: applyTreeLayout(uniqueNodes, uniqueEdges), edges: uniqueEdges };
}
