import { describe, expect, it } from 'vitest';
import { syntheticBillingAccounts, syntheticProjects } from '../data/syntheticAudit';
import { buildGraph, projectNodeId, serviceNodeId } from './builder';

describe('buildGraph', () => {
  it('links billing accounts, projects, API keys, and services without duplicate IDs', () => {
    const { nodes, edges } = buildGraph(syntheticBillingAccounts, syntheticProjects);
    const nodeIds = nodes.map((node) => node.id);
    const edgeIds = edges.map((edge) => edge.id);

    expect(nodes).toHaveLength(23);
    expect(edges).toHaveLength(20);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
    expect(nodes).toContainEqual(expect.objectContaining({
      id: serviceNodeId('retail-production-demo', 'compute.googleapis.com'),
      type: 'service',
    }));
    expect(edges).toContainEqual(expect.objectContaining({
      source: projectNodeId('retail-production-demo'),
      target: serviceNodeId('retail-production-demo', 'compute.googleapis.com'),
    }));
  });

  it('deduplicates repeated resources by their stable IDs', () => {
    const duplicated = {
      ...syntheticProjects[0],
      apiKeys: [syntheticProjects[0].apiKeys[0], syntheticProjects[0].apiKeys[0]],
      services: [syntheticProjects[0].services[0], syntheticProjects[0].services[0]],
    };

    const { nodes, edges } = buildGraph([], [duplicated]);

    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
  });
});
