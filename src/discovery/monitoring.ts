import { gcpFetch } from './GCPClient';
import type { UsageData } from '../types';
import { GCP_API } from './constants';

interface TimeSeriesResponse {
  timeSeries?: Array<{
    metric: { type: string; labels: Record<string, string> };
    points?: Array<{
      interval: unknown;
      value: { int64Value?: string; doubleValue?: number };
    }>;
  }>;
}

function sumPoints(resp: TimeSeriesResponse): number {
  let total = 0;
  for (const ts of resp.timeSeries ?? []) {
    for (const pt of ts.points ?? []) {
      total += parseInt(pt.value.int64Value ?? '0', 10) || (pt.value.doubleValue ?? 0);
    }
  }
  return total;
}

export async function getProjectUsage(projectId: string, signal?: AbortSignal): Promise<UsageData> {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const base = `${GCP_API.MONITORING}/projects/${projectId}/timeSeries`;

  const commonParams = {
    'interval.startTime': start.toISOString(),
    'interval.endTime': now.toISOString(),
    'aggregation.alignmentPeriod': '2592000s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
  };

  const [tokenResult, requestResult] = await Promise.allSettled([
    gcpFetch<TimeSeriesResponse>(
      `${base}?${new URLSearchParams({
        ...commonParams,
        filter: 'metric.type="aiplatform.googleapis.com/prediction/online/token_count"',
      })}`,
      {},
      signal,
    ),
    gcpFetch<TimeSeriesResponse>(
      `${base}?${new URLSearchParams({
        ...commonParams,
        filter: 'metric.type="serviceruntime.googleapis.com/api/request_count"',
      })}`,
      {},
      signal,
    ),
  ]);

  // If both metric queries failed, propagate the error so the caller counts it
  if (tokenResult.status === 'rejected' && requestResult.status === 'rejected') {
    console.warn(`[discovery] Usage metrics failed for ${projectId}:`, tokenResult.reason);
    throw tokenResult.reason;
  }

  return {
    projectId,
    tokenCount: tokenResult.status === 'fulfilled' ? sumPoints(tokenResult.value) : undefined,
    requestCount: requestResult.status === 'fulfilled' ? sumPoints(requestResult.value) : undefined,
  };
}
