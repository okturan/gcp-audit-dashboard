import { describe, expect, it } from 'vitest';
import { syntheticBillingAccounts, syntheticProjects } from './syntheticAudit';

describe('synthetic audit fixture', () => {
  it('contains enough linked resources to exercise every dashboard view', () => {
    expect(syntheticBillingAccounts).toHaveLength(2);
    expect(syntheticProjects).toHaveLength(3);
    expect(syntheticProjects.flatMap((project) => project.apiKeys)).toHaveLength(3);
    expect(syntheticProjects.flatMap((project) => project.services).length).toBeGreaterThan(10);
    expect(syntheticProjects.every((project) => project.usage)).toBe(true);
  });

  it('contains no credential-shaped fields or real domains', () => {
    const json = JSON.stringify({
      billingAccounts: syntheticBillingAccounts,
      projects: syntheticProjects,
    });

    expect(json).not.toMatch(/private[_-]?key|access[_-]?token|client[_-]?secret/i);
    expect(json).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(json).not.toMatch(/@(?![^"@]*example\.invalid)[^"@]+\.[a-z]{2,}/i);
  });
});
