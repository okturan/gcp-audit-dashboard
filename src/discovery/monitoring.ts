import { gcpFetch } from './GCPClient';
import type { UsageData, TimeSeriesPoint } from '../types';
import { GCP_API } from './constants';

interface TimeSeriesResponse {
  timeSeries?: Array<{
    metric: { type: string; labels: Record<string, string> };
    points?: Array<{
      interval: { startTime?: string; endTime?: string };
      value: { int64Value?: string; doubleValue?: number };
    }>;
  }>;
}

function pointValue(pt: { value: { int64Value?: string; doubleValue?: number } }): number {
  return parseInt(pt.value.int64Value ?? '0', 10) || (pt.value.doubleValue ?? 0);
}

function sumPoints(resp: TimeSeriesResponse): number {
  let total = 0;
  for (const ts of resp.timeSeries ?? []) {
    for (const pt of ts.points ?? []) total += pointValue(pt);
  }
  return total;
}

function breakdownByService(resp: TimeSeriesResponse): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ts of resp.timeSeries ?? []) {
    const svc = ts.metric.labels?.service ?? 'unknown';
    let sum = 0;
    for (const pt of ts.points ?? []) sum += pointValue(pt);
    map[svc] = (map[svc] ?? 0) + sum;
  }
  return map;
}

function breakdownByResponseCode(resp: TimeSeriesResponse): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ts of resp.timeSeries ?? []) {
    const code = ts.metric.labels?.response_code ?? '';
    const bucket = code.length >= 1 ? `${code[0]}xx` : 'other';
    let sum = 0;
    for (const pt of ts.points ?? []) sum += pointValue(pt);
    map[bucket] = (map[bucket] ?? 0) + sum;
  }
  return map;
}

function buildTimeSeries(resp: TimeSeriesResponse): TimeSeriesPoint[] {
  const byDate: Record<string, number> = {};
  for (const ts of resp.timeSeries ?? []) {
    for (const pt of ts.points ?? []) {
      const raw = pt.interval.endTime ?? pt.interval.startTime;
      if (!raw) continue;
      const date = raw.slice(0, 10); // YYYY-MM-DD
      byDate[date] = (byDate[date] ?? 0) + pointValue(pt);
    }
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export async function getProjectUsage(projectId: string, signal?: AbortSignal): Promise<UsageData> {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const base = `${GCP_API.MONITORING}/projects/${projectId}/timeSeries`;

  const commonParams = {
    'interval.startTime': start.toISOString(),
    'interval.endTime': now.toISOString(),
    'aggregation.alignmentPeriod': '86400s',
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

  const tokenResp = tokenResult.status === 'fulfilled' ? tokenResult.value : undefined;
  const requestResp = requestResult.status === 'fulfilled' ? requestResult.value : undefined;

  return {
    projectId,
    tokenCount: tokenResp ? sumPoints(tokenResp) : undefined,
    requestCount: requestResp ? sumPoints(requestResp) : undefined,
    requestBreakdown: requestResp ? breakdownByService(requestResp) : undefined,
    tokenBreakdown: tokenResp ? breakdownByService(tokenResp) : undefined,
    responseCodeBreakdown: requestResp ? breakdownByResponseCode(requestResp) : undefined,
    requestTimeSeries: requestResp ? buildTimeSeries(requestResp) : undefined,
    tokenTimeSeries: tokenResp ? buildTimeSeries(tokenResp) : undefined,
  };
}
