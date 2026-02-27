import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useGCPStore } from '../store/useGCPStore';
import type { ProjectDiscovery } from '../types';
import { fmt } from '../utils/format';

const CHART_BG = '#0d1117';
const AXIS_COLOR = '#7d8590';
const GRID_COLOR = '#21262d';

const byValue = (a: { value: number }, b: { value: number }) => b.value - a.value;

function shortName(pd: ProjectDiscovery) {
  const name = pd.project.displayName || pd.project.projectId;
  return name.length > 20 ? name.slice(0, 18) + '…' : name;
}

const tooltipStyle: React.CSSProperties = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 6,
  fontSize: 11,
  color: '#e6edf3',
};

function HBar({
  data,
  dataKey,
  color,
  labelColor = '#8b949e',
}: {
  data: { name: string; value: number }[];
  dataKey: string;
  color: string;
  labelColor?: string;
}) {
  const barHeight = 24;
  const chartHeight = data.length * barHeight + 24;
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <XAxis
          type="number"
          hide
          domain={[0, (d: number) => Math.ceil(d * 1.15)]}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: GRID_COLOR }}
          contentStyle={tooltipStyle}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [fmt(Number(v)), dataKey]}
          labelStyle={{ color: '#c9d1d9' }}
          itemStyle={{ color: '#e6edf3' }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} background={{ fill: CHART_BG }} minPointSize={2}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.value === 0 ? '#21262d' : color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => {
              const { x, y, width, height, value } = props;
              const isZero = Number(value) === 0;
              return (
                <text
                  x={x + width + 4}
                  y={y + height / 2 + 4}
                  fill={isZero ? '#7d8590' : labelColor}
                  fontSize={10}
                >
                  {fmt(Number(value))}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ChartsView() {
  const { rawProjects, discoveryState, discoveryError } = useGCPStore();

  const requestData = useMemo(
    () => rawProjects.map((pd) => ({ name: shortName(pd), value: pd.usage?.requestCount ?? 0 })).sort(byValue),
    [rawProjects]
  );
  const tokenData = useMemo(
    () => rawProjects.map((pd) => ({ name: shortName(pd), value: pd.usage?.tokenCount ?? 0 })).sort(byValue),
    [rawProjects]
  );
  const serviceData = useMemo(
    () => rawProjects.map((pd) => ({ name: shortName(pd), value: pd.services.length })).sort(byValue),
    [rawProjects]
  );
  const keyData = useMemo(
    () => rawProjects.map((pd) => ({ name: shortName(pd), value: pd.apiKeys.length })).sort(byValue),
    [rawProjects]
  );
  const saData = useMemo(
    () => rawProjects.map((pd) => ({ name: shortName(pd), value: pd.serviceAccounts?.length ?? 0 })).sort(byValue),
    [rawProjects]
  );
  const iamData = useMemo(
    () => rawProjects.map((pd) => ({
      name: shortName(pd),
      value: pd.iamBindings?.reduce((n, b) => n + b.members.length, 0) ?? 0,
    })).sort(byValue),
    [rawProjects]
  );

  if (discoveryState !== 'success') {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: discoveryError ? '#f85149' : '#7d8590', fontSize: 13, background: CHART_BG,
        padding: 24, textAlign: 'center',
      }}>
        {discoveryError ? `Error: ${discoveryError}` : 'Run discovery to see charts'}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: CHART_BG, padding: '20px 24px 32px' }}>
      <div className="charts-grid">
        <ChartCard title="30d API Requests">
          <HBar data={requestData} dataKey="requests" color="#1f6feb" labelColor="#58a6ff" />
        </ChartCard>
        <ChartCard title="30d AI Tokens">
          <HBar data={tokenData} dataKey="tokens" color="#8957e5" labelColor="#a78bfa" />
        </ChartCard>
        <ChartCard title="Enabled Services">
          <HBar data={serviceData} dataKey="services" color="#0d419d" labelColor="#58a6ff" />
        </ChartCard>
        <ChartCard title="API Keys">
          <HBar data={keyData} dataKey="keys" color="#1a4a28" labelColor="#3fb950" />
        </ChartCard>
        <ChartCard title="Service Accounts">
          <HBar data={saData} dataKey="service accounts" color="#4a1d42" labelColor="#c084fc" />
        </ChartCard>
        <ChartCard title="IAM Members">
          <HBar data={iamData} dataKey="members" color="#4a2d0d" labelColor="#f0883e" />
        </ChartCard>
      </div>
    </div>
  );
}
