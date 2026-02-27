import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { useGCPStore } from '../store/useGCPStore';
import { computeFindings } from '../utils/findings';
import { fmt } from '../utils/format';
import type { ViewId } from '../store/useGCPStore';

export function OverviewView() {
  const {
    discoveryState,
    discoveryError,
    discoveryProgress,
    discoveryTotal,
    discoveryDone,
    discover,
    gcloudEmail,
    authMethod,
    signOut,
  } = useGCPStore();

  // Pre-discovery: welcome + CTA
  if (discoveryState === 'idle') {
    const isServiceAccount = gcloudEmail?.includes('iam.gserviceaccount.com');
    return (
      <div style={centeredStyle}>
        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.8 }}>☁️</div>
        <h2 style={{ color: '#e6edf3', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Welcome to GCP Dashboard
        </h2>
        <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 16, maxWidth: 400, textAlign: 'center' }}>
          Discover and audit your Google Cloud Platform projects, API keys, services, and IAM policies.
        </p>

        {/* Show current account identity */}
        {gcloudEmail && (
          <div style={{
            background: isServiceAccount ? '#1c1a0e' : '#0c1929',
            border: `1px solid ${isServiceAccount ? '#d9770633' : '#1d4778'}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            maxWidth: 480,
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Signed in as{authMethod === 'gcloud' ? ' (via gcloud CLI)' : ''}
            </div>
            <div style={{ fontSize: 13, color: isServiceAccount ? '#d97706' : '#58a6ff', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {gcloudEmail}
            </div>
            {isServiceAccount && (
              <div style={{ fontSize: 11, color: '#f0883e', marginTop: 6 }}>
                This is a service account. You may want to switch to your personal account.
              </div>
            )}
          </div>
        )}

        <button
          onClick={discover}
          className="btn-primary"
          style={{
            background: '#1f6feb',
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Discover GCP Resources
        </button>

        {/* Switch account hint */}
        {authMethod === 'gcloud' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <button
              onClick={signOut}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Sign out and use a different account
            </button>
            <span style={{ fontSize: 11, color: '#7d8590', maxWidth: 400, textAlign: 'center' }}>
              To switch gcloud accounts: <code style={{ color: '#8b949e' }}>gcloud config set account YOUR_EMAIL</code>
            </span>
          </div>
        )}
      </div>
    );
  }

  // During discovery: progress
  if (discoveryState === 'loading') {
    const pct = discoveryTotal > 0 ? Math.round((discoveryDone / discoveryTotal) * 100) : 0;
    return (
      <div style={centeredStyle}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
        <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 12 }}>
          {discoveryProgress || 'Discovering…'}
        </p>
        <div style={{ width: 320, maxWidth: '80%' }}>
          {discoveryTotal > 0 ? (
            <>
              <div style={{ height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#1f6feb', borderRadius: 3, transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: '#7d8590', marginTop: 6, textAlign: 'center' }}>
                {discoveryDone} / {discoveryTotal} projects
              </div>
            </>
          ) : (
            <div className="shimmer-bar" style={{ height: 6, borderRadius: 3 }} />
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (discoveryState === 'error') {
    return (
      <div style={centeredStyle}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>❌</div>
        <p style={{ color: '#f85149', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Discovery failed</p>
        {discoveryError && (
          <p style={{ color: '#8b949e', fontSize: 12, maxWidth: 560, textAlign: 'center', lineHeight: 1.5 }}>
            {discoveryError}
          </p>
        )}
        <button
          onClick={discover}
          style={{
            marginTop: 20,
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '8px 20px',
            color: '#e6edf3',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Success — show dashboard
  return <OverviewDashboard />;
}

function OverviewDashboard() {
  const {
    rawProjects,
    rawBillingAccounts,
    setActiveView,
    openDetailDrawer,
  } = useGCPStore();

  const findings = useMemo(
    () => computeFindings(rawBillingAccounts, rawProjects),
    [rawBillingAccounts, rawProjects]
  );

  let redCount = 0, yellowCount = 0;
  for (const f of findings) {
    if (f.severity === 'red') redCount++;
    else if (f.severity === 'yellow') yellowCount++;
  }
  const totalKeys = rawProjects.reduce((n, p) => n + p.apiKeys.length, 0);
  const totalSAs = rawProjects.reduce((n, p) => n + (p.serviceAccounts?.length ?? 0), 0);
  const totalServices = rawProjects.reduce((n, p) => n + p.services.length, 0);

  // Health score: 100 - (critical * 15 + warnings * 5), clamped to 0–100
  const healthScore = Math.max(0, Math.min(100, 100 - redCount * 15 - yellowCount * 5));
  const healthColor = healthScore >= 80 ? '#3fb950' : healthScore >= 50 ? '#f0883e' : '#f85149';

  const pieData = [
    { value: healthScore, color: healthColor },
    { value: 100 - healthScore, color: '#21262d' },
  ];

  // Mini charts: top requests & tokens
  const requestData = useMemo(
    () => rawProjects
      .map((pd) => ({ name: shortName(pd), nodeId: `project-${pd.project.projectId}`, value: pd.usage?.requestCount ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    [rawProjects]
  );
  const tokenData = useMemo(
    () => rawProjects
      .map((pd) => ({ name: shortName(pd), nodeId: `project-${pd.project.projectId}`, value: pd.usage?.tokenCount ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),
    [rawProjects]
  );

  const topFindings = findings.slice(0, 5);

  function navTo(view: ViewId) {
    setActiveView(view);
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0d1117', padding: '24px 32px 48px' }}>
      {/* Row 1: Health score + stat cards */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Health score donut */}
        <div style={{
          background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
          minWidth: 160,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Security Health
          </div>
          <div style={{ width: 110, height: 110, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={50}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: healthColor }}>{healthScore}</span>
              <span style={{ fontSize: 9, color: '#8b949e' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="stat-grid">
            <StatCard label="Projects" value={rawProjects.length} color="#58a6ff" onClick={() => navTo('table')} />
            <StatCard label="API Keys" value={totalKeys} color="#3fb950" onClick={() => navTo('table')} />
            <StatCard label="Service Accounts" value={totalSAs} color="#f0883e" />
            <StatCard label="Critical Findings" value={redCount} color="#f85149" onClick={() => navTo('findings')} />
            <StatCard label="Warnings" value={yellowCount} color="#f0883e" onClick={() => navTo('findings')} />
            <StatCard label="Enabled Services" value={totalServices} color="#8b949e" />
          </div>
        </div>
      </div>

      {/* Row 2: Top findings + Quick links */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Top findings */}
        <div style={{
          flex: 2, minWidth: 340, background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #30363d',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Top Findings
            </span>
            {findings.length > 5 && (
              <button
                onClick={() => navTo('findings')}
                style={{
                  background: 'none', border: 'none', color: '#58a6ff', fontSize: 11,
                  cursor: 'pointer', padding: 0,
                }}
              >
                View all ({findings.length})
              </button>
            )}
          </div>
          {topFindings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#3fb950', fontSize: 13 }}>
              No issues detected
            </div>
          ) : (
            topFindings.map((f, i) => (
              <div
                key={i}
                className="finding-row"
                onClick={() => openDetailDrawer(f.nodeId)}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #21262d',
                  borderLeft: `3px solid ${f.severity === 'red' ? '#f85149' : '#f0883e'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: f.severity === 'red' ? '#f85149' : '#f0883e', marginBottom: 2 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>{f.body}</div>
              </div>
            ))
          )}
        </div>

        {/* Quick links */}
        <div style={{
          flex: 1, minWidth: 200, background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
          padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Quick Links
          </div>
          <QuickLink label="View unrestricted keys" onClick={() => navTo('findings')} />
          <QuickLink label="View all API keys" onClick={() => navTo('table')} />
          <QuickLink label="View charts" onClick={() => navTo('charts')} />
          <QuickLink label="Open graph view" onClick={() => navTo('graph')} />
        </div>
      </div>

      {/* Row 3: Mini charts */}
      {(requestData.some((d) => d.value > 0) || tokenData.some((d) => d.value > 0)) && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {requestData.some((d) => d.value > 0) && (
            <MiniBarChart title="Top 5 — 30d Requests" data={requestData} color="#1f6feb" labelColor="#58a6ff" onBarClick={(nodeId) => openDetailDrawer(nodeId)} />
          )}
          {tokenData.some((d) => d.value > 0) && (
            <MiniBarChart title="Top 5 — 30d Tokens" data={tokenData} color="#8957e5" labelColor="#a78bfa" onBarClick={(nodeId) => openDetailDrawer(nodeId)} />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={onClick ? 'stat-card' : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${label}: ${value}` : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 8,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="quick-link"
      style={{
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 12px',
        color: '#58a6ff',
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
    >
      {label} →
    </button>
  );
}

function MiniBarChart({ title, data, color, labelColor, onBarClick }: {
  title: string;
  data: { name: string; nodeId: string; value: number }[];
  color: string;
  labelColor: string;
  onBarClick?: (nodeId: string) => void;
}) {
  const barHeight = 24;
  const chartHeight = data.length * barHeight + 24;
  return (
    <div style={{
      flex: 1, minWidth: 340, background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 12,
      }}>
        {title}
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={[0, (d: number) => Math.ceil(d * 1.15)]} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: '#7d8590', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#21262d' }}
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 11, color: '#e6edf3' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [fmt(Number(v)), '']}
            labelStyle={{ color: '#c9d1d9' }}
            itemStyle={{ color: '#e6edf3' }}
          />
          <Bar
            dataKey="value"
            radius={[0, 3, 3, 0]}
            background={{ fill: '#0d1117' }}
            minPointSize={2}
            fill={color}
            cursor={onBarClick ? 'pointer' : undefined}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={onBarClick ? (_entry: any, index: number) => { onBarClick(data[index].nodeId); } : undefined}
          >
            <LabelList
              dataKey="value"
              position="right"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={(props: any) => {
                const { x, y, width, height, value } = props;
                return (
                  <text x={x + width + 4} y={y + height / 2 + 4} fill={labelColor} fontSize={10}>
                    {fmt(Number(value))}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function shortName(pd: { project: { displayName?: string; projectId: string } }) {
  const name = pd.project.displayName || pd.project.projectId;
  return name.length > 20 ? name.slice(0, 18) + '…' : name;
}

const centeredStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0d1117',
};
