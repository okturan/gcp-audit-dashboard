import { afterEach, describe, expect, it, vi } from 'vitest';
import { syntheticBillingAccounts, syntheticProjects } from '../data/syntheticAudit';
import { computeFindings } from './findings';

describe('computeFindings', () => {
  afterEach(() => vi.useRealTimers());

  it('derives the expected findings from the fixed synthetic audit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T12:00:00Z'));

    const findings = computeFindings(syntheticBillingAccounts, syntheticProjects);

    expect(findings).toHaveLength(9);
    expect(findings.filter((finding) => finding.severity === 'red')).toHaveLength(4);
    expect(findings.filter((finding) => finding.severity === 'yellow')).toHaveLength(5);
    expect(findings.map((finding) => finding.title)).toEqual(expect.arrayContaining([
      expect.stringContaining('Unrestricted key'),
      expect.stringContaining('Stale IAM'),
      'Public IAM binding',
      expect.stringContaining('Zombie'),
      'Disabled SA in IAM',
      expect.stringContaining('Closed billing'),
    ]));
  });

  it('returns no findings for an empty audit', () => {
    expect(computeFindings([], [])).toEqual([]);
  });
});
