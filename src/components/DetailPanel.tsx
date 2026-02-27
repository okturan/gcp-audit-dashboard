import { useState, useMemo } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
import { useGCPStore, addToast } from '../store/useGCPStore';
import { fmt } from '../utils/format';
import type { AppNode, IAMBinding, ProjectServiceAccount } from '../types';

function getNodeLabel(node: AppNode): string {
  switch (node.type) {
    case 'billingAccount': return node.data.billingAccount.displayName;
    case 'project': return node.data.project.displayName || node.data.project.projectId;
    case 'apiKey': return node.data.apiKey.displayName || node.data.apiKey.uid.slice(0, 12);
    case 'service': return node.data.service.config?.name ?? 'service';
  }
}

function buildBreadcrumb(
  nodeId: string,
  nodeMap: Map<string, AppNode>,
  parentMap: Map<string, string>,
): { id: string; label: string }[] {
  const path: { id: string; label: string }[] = [];
  let cur: string | undefined = nodeId;
  while (cur) {
    const n = nodeMap.get(cur);
    if (n) path.unshift({ id: cur, label: getNodeLabel(n) });
    cur = parentMap.get(cur);
  }
  return path;
}

export function DetailPanel() {
  const { selectedNodeId, nodes, edges, insights, panToNode } = useGCPStore();

  // Memoize maps separately so they don't rebuild when only selectedNodeId changes
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const parentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of edges) m.set(e.target, e.source);
    return m;
  }, [edges]);

  const breadcrumb = useMemo(
    () => selectedNodeId ? buildBreadcrumb(selectedNodeId, nodeMap, parentMap) : [],
    [selectedNodeId, nodeMap, parentMap]
  );

  if (!selectedNodeId) {
    return (
      <div
        style={{
          padding: 16,
          background: '#0d1117',
          color: '#7d8590',
          fontSize: 12,
          textAlign: 'center',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 20, opacity: 0.4 }}>🔍</div>
        <div>Click a node or list item to see details</div>
        <div style={{ fontSize: 10, color: '#30363d' }}>Arrow keys to navigate</div>
      </div>
    );
  }

  const node = nodes.find((n) => n.id === selectedNodeId) as AppNode | undefined;
  if (!node) {
    return (
      <div
        style={{
          padding: 16,
          background: '#0d1117',
          color: '#7d8590',
          fontSize: 12,
          textAlign: 'center',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 20, opacity: 0.4 }}>🚫</div>
        <div>Selected node is not visible</div>
        <div style={{ fontSize: 10, color: '#30363d' }}>It may be hidden by a filter</div>
      </div>
    );
  }

  const insight = insights[selectedNodeId];

  return (
    <div
      style={{
        padding: 14,
        background: '#0d1117',
        overflowY: 'auto',
        flex: 1,
        fontSize: 12,
        color: '#e6edf3',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {breadcrumb.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 10 }}>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: '#30363d' }}>/</span>}
              <span
                onClick={() => { if (crumb.id !== selectedNodeId) panToNode(crumb.id); }}
                className={crumb.id !== selectedNodeId ? 'breadcrumb-link' : undefined}
                style={{
                  color: crumb.id === selectedNodeId ? '#e6edf3' : '#58a6ff',
                  cursor: crumb.id === selectedNodeId ? 'default' : 'pointer',
                  fontWeight: crumb.id === selectedNodeId ? 600 : 400,
                }}
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </div>
      )}
      <NodeDetails node={node} />

      {insight && (
        <DetailSection title="✨ Claude Analysis">
          <div
            style={{
              borderLeft: `3px solid ${
                insight.severity === 'red' ? '#f85149' : insight.severity === 'yellow' ? '#f0883e' : '#3fb950'
              }`,
              padding: '8px 12px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: 6 }}>{insight.summary}</div>
            {insight.suggestions.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16, color: '#8b949e', lineHeight: 1.7 }}>
                {insight.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

function NodeDetails({ node }: { node: AppNode }) {
  if (node.type === 'billingAccount') {
    const ba = (node.data as { billingAccount: import('../types').BillingAccount }).billingAccount;
    const accountId = ba.name.split('/')[1];
    return (
      <DetailSection title="Billing Account">
        <DetailRow label="Name" value={ba.displayName} />
        <DetailRow label="ID" value={accountId} mono />
        <DetailRow label="Status" value={ba.open ? '✅ Open' : '❌ Closed'} />
        <DetailRow label="Currency" value={ba.currencyCode} />
        {ba.masterBillingAccount && <DetailRow label="Master Account" value={ba.masterBillingAccount} mono />}
        <ConsoleLink url={`https://console.cloud.google.com/billing/${accountId}`} />
      </DetailSection>
    );
  }

  if (node.type === 'project') {
    const { project, billingInfo, apiKeyCount, serviceCount, services = [], usage, iamBindings = [], serviceAccounts = [] } =
      node.data as import('../types').ProjectNodeData;

    const createdDate = project.createTime ? new Date(project.createTime).toLocaleDateString() : '—';
    const updatedDate = project.updateTime ? new Date(project.updateTime).toLocaleDateString() : '—';
    const labelEntries = project.labels ? Object.entries(project.labels) : [];

    return (
      <>
        <DetailSection title="Project">
          <DetailRow label="Name" value={project.displayName || project.projectId} />
          <DetailRow label="Project ID" value={project.projectId} mono />
          <DetailRow label="State" value={project.state} />
          <DetailRow label="Billing" value={billingInfo?.billingEnabled ? '✅ Enabled' : '❌ Disabled'} />
          {billingInfo?.billingEnabled && (
            <DetailRow label="Billing Account" value={billingInfo.billingAccountName.split('/')[1]} mono />
          )}
          <DetailRow label="API Keys" value={String(apiKeyCount)} />
          <DetailRow label="Services" value={String(serviceCount)} />
          <DetailRow label="Created" value={createdDate} />
          <DetailRow label="Updated" value={updatedDate} />
          {usage?.requestCount !== undefined && (
            <DetailRow label="30d Requests" value={usage.requestCount.toLocaleString()} />
          )}
          {usage?.tokenCount !== undefined && (
            <DetailRow label="30d Tokens" value={usage.tokenCount.toLocaleString()} />
          )}
          {labelEntries.length > 0 && (
            <DetailRow label="Labels" value={labelEntries.map(([k, v]) => `${k}=${v}`).join(', ')} />
          )}
          <ConsoleLink url={`https://console.cloud.google.com/home/dashboard?project=${project.projectId}`} />
        </DetailSection>

        {usage?.requestTimeSeries && usage.requestTimeSeries.length > 1 && (
          <Sparkline title="Request Trend (30d)" data={usage.requestTimeSeries} color="#1f6feb" />
        )}
        {usage?.tokenTimeSeries && usage.tokenTimeSeries.length > 1 && (
          <Sparkline title="Token Trend (30d)" data={usage.tokenTimeSeries} color="#8957e5" />
        )}

        {usage?.responseCodeBreakdown && Object.keys(usage.responseCodeBreakdown).length > 0 && (
          <ResponseCodeBar breakdown={usage.responseCodeBreakdown} total={usage.requestCount ?? 0} />
        )}

        {usage?.requestBreakdown && Object.keys(usage.requestBreakdown).length > 0 && (
          <UsageBreakdownChart title="30d Requests by Service" breakdown={usage.requestBreakdown} color="#1f6feb" labelColor="#58a6ff" />
        )}
        {usage?.tokenBreakdown && Object.keys(usage.tokenBreakdown).length > 0 && (
          <UsageBreakdownChart title="30d Tokens by Service" breakdown={usage.tokenBreakdown} color="#8957e5" labelColor="#a78bfa" />
        )}

        {iamBindings.length > 0 && <IAMBindingsSection bindings={iamBindings} />}

        {serviceAccounts.length > 0 && <ServiceAccountsSection accounts={serviceAccounts} />}

        {services.length > 0 && (
          <CollapsibleSection title={`Enabled Services (${services.length})`}>
            <div style={{ padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {services.map((svc) => {
                const name = svc.config?.name ?? svc.name.split('/').pop() ?? 'unknown';
                return (
                  <span
                    key={name}
                    className="service-pill"
                    style={{
                      fontSize: 10,
                      border: '1px solid #30363d',
                      borderRadius: 999,
                      padding: '2px 7px',
                      color: '#8b949e',
                      background: '#0d1117',
                    }}
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          </CollapsibleSection>
        )}
      </>
    );
  }

  if (node.type === 'apiKey') {
    const { apiKey } = node.data as import('../types').APIKeyNodeData;
    const r = apiKey.restrictions;
    const apiTargets = r?.apiTargets?.map((t) => {
      const methods = t.methods?.length ? ` [${t.methods.join(', ')}]` : '';
      return `${t.service}${methods}`;
    });
    const browserReferrers = r?.browserKeyRestrictions?.allowedReferrers;
    const serverIPs = r?.serverKeyRestrictions?.allowedIps;

    const restrictionType = !r || (!r.apiTargets?.length && !r.browserKeyRestrictions && !r.serverKeyRestrictions)
      ? '⚠️ Unrestricted'
      : r.apiTargets?.length
        ? '🎯 API Targets'
        : r.browserKeyRestrictions
          ? '🌐 Browser (HTTP referrers)'
          : '🖥 Server (IP addresses)';

    // eslint-disable-next-line react-hooks/purity -- age-in-days is inherently time-dependent
    const ageMs = apiKey.createTime ? Date.now() - new Date(apiKey.createTime).getTime() : undefined;
    const ageDays = ageMs !== undefined ? Math.floor(ageMs / 86_400_000) : undefined;

    return (
      <DetailSection title="API Key">
        <DetailRow label="Display Name" value={apiKey.displayName || '(unnamed)'} />
        <DetailRow label="UID" value={apiKey.uid} mono />
        <DetailRow label="Restriction Type" value={restrictionType} />
        {apiTargets?.length && (
          <DetailRow label="Allowed APIs" value={apiTargets.join('\n')} />
        )}
        {browserReferrers?.length && (
          <DetailRow label="Allowed Referrers" value={browserReferrers.join('\n')} />
        )}
        {serverIPs?.length && (
          <DetailRow label="Allowed IPs" value={serverIPs.join(', ')} />
        )}
        <DetailRow
          label="Created"
          value={apiKey.createTime ? new Date(apiKey.createTime).toLocaleDateString() : '—'}
        />
        {ageDays !== undefined && <DetailRow label="Age" value={`${ageDays} days`} />}
        <DetailRow
          label="Updated"
          value={apiKey.updateTime ? new Date(apiKey.updateTime).toLocaleDateString() : '—'}
        />
        <ConsoleLink url={`https://console.cloud.google.com/apis/credentials?project=${(node.data as import('../types').APIKeyNodeData).projectId}`} />
      </DetailSection>
    );
  }

  if (node.type === 'service') {
    const { service, projectId: svcProjectId } = node.data as import('../types').ServiceNodeData;
    const svcName = service.config?.name ?? service.name.split('/').pop() ?? 'unknown';
    return (
      <DetailSection title="Service">
        <DetailRow label="Title" value={service.config?.title ?? '—'} />
        <DetailRow label="API" value={svcName} mono />
        <DetailRow label="State" value={service.state} />
        {service.config?.documentation?.summary && (
          <DetailRow label="About" value={service.config.documentation.summary} />
        )}
        <ConsoleLink url={`https://console.cloud.google.com/apis/api/${svcName}/overview?project=${svcProjectId}`} />
      </DetailSection>
    );
  }

  return null;
}

const RESPONSE_CODE_COLORS: Record<string, string> = {
  '2xx': '#3fb950',
  '3xx': '#58a6ff',
  '4xx': '#f0883e',
  '5xx': '#f85149',
  other: '#8b949e',
};

const RESPONSE_CODE_ORDER = ['2xx', '3xx', '4xx', '5xx', 'other'];

function ResponseCodeBar({ breakdown, total }: {
  breakdown: Record<string, number>;
  total: number;
}) {
  if (total === 0) return null;
  const sorted = RESPONSE_CODE_ORDER.filter((k) => breakdown[k]);

  return (
    <DetailSection title="Response Codes">
      {/* Stacked bar */}
      <div style={{ padding: '10px 12px 6px' }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
          {sorted.map((code) => {
            const pct = (breakdown[code] / total) * 100;
            return (
              <div
                key={code}
                style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? 3 : 0,
                  background: RESPONSE_CODE_COLORS[code] ?? '#8b949e',
                }}
              />
            );
          })}
        </div>
      </div>
      {/* Legend rows */}
      {sorted.map((code) => {
        const count = breakdown[code];
        const pct = ((count / total) * 100).toFixed(1);
        return (
          <div
            key={code}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 12px',
              borderBottom: '1px solid #21262d',
              fontSize: 11,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: RESPONSE_CODE_COLORS[code] ?? '#8b949e',
                flexShrink: 0,
              }} />
              <span style={{ color: '#c9d1d9' }}>{code}</span>
            </span>
            <span style={{ color: '#8b949e', fontFamily: 'monospace', fontSize: 10 }}>
              {fmt(count)}{' '}
              <span style={{ color: '#7d8590' }}>({pct}%)</span>
            </span>
          </div>
        );
      })}
    </DetailSection>
  );
}

function Sparkline({ title, data, color }: {
  title: string;
  data: { date: string; value: number }[];
  color: string;
}) {
  return (
    <DetailSection title={title}>
      <div style={{ padding: '8px 4px 4px' }}>
        <ResponsiveContainer width="100%" height={64}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              cursor={{ stroke: '#30363d' }}
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 10, color: '#e6edf3' }}
              labelFormatter={(d) => String(d)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmt(Number(v)), '']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${color.replace('#', '')})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DetailSection>
  );
}

function UsageBreakdownChart({ title, breakdown, color, labelColor }: {
  title: string;
  breakdown: Record<string, number>;
  color: string;
  labelColor: string;
}) {
  const data = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  const barHeight = 22;
  const chartHeight = data.length * barHeight + 24;

  return (
    <DetailSection title={title}>
      <div style={{ padding: '8px 4px 4px 4px' }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, (d: number) => Math.ceil(d * 1.15)]} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: '#7d8590', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#21262d' }}
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, fontSize: 11, color: '#e6edf3' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmt(Number(v)), '']}
              labelStyle={{ color: '#c9d1d9' }}
            />
            <Bar
              dataKey="value"
              radius={[0, 3, 3, 0]}
              background={{ fill: '#0d1117' }}
              minPointSize={2}
              fill={color}
            >
              <LabelList
                dataKey="value"
                position="right"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={(props: any) => {
                  const { x, y, width: w, height: h, value } = props;
                  return (
                    <text x={x + w + 4} y={y + h / 2 + 3} fill={labelColor} fontSize={9}>
                      {fmt(Number(value))}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DetailSection>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        className="collapsible-header"
        role="button"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: open ? 8 : 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#7d8590', fontSize: 9 }}>{open ? '▾' : '▸'}</span>
        {title}
      </div>
      {open && (
        <div
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function IAMBindingsSection({ bindings }: { bindings: IAMBinding[] }) {
  const sorted = [...bindings].sort((a, b) => a.role.localeCompare(b.role));
  return (
    <CollapsibleSection title={`IAM Bindings (${bindings.reduce((n, b) => n + b.members.length, 0)} members)`}>
      {sorted.map((binding) => (
        <div
          key={binding.role}
          style={{ padding: '6px 12px', borderBottom: '1px solid #21262d' }}
        >
          <div style={{ color: '#58a6ff', fontSize: 10, fontWeight: 600, marginBottom: 3, fontFamily: 'monospace' }}>
            {binding.role.replace('roles/', '')}
          </div>
          {binding.members.map((m) => {
            const [type, id] = m.split(':');
            const color = type === 'user' ? '#3fb950' : type === 'serviceAccount' ? '#f0883e' : '#8b949e';
            return (
              <div
                key={m}
                style={{ fontSize: 10, color, marginBottom: 1, fontFamily: 'monospace', paddingLeft: 8 }}
              >
                <span style={{ color: '#7d8590' }}>{type}:</span>
                {id ?? m}
              </div>
            );
          })}
        </div>
      ))}
    </CollapsibleSection>
  );
}

function ServiceAccountsSection({ accounts }: { accounts: ProjectServiceAccount[] }) {
  return (
    <CollapsibleSection title={`Service Accounts (${accounts.length})`}>
      {accounts.map((sa) => (
        <div
          key={sa.email}
          style={{ padding: '6px 12px', borderBottom: '1px solid #21262d' }}
        >
          <div style={{ color: sa.disabled ? '#7d8590' : '#f0883e', fontSize: 11, fontFamily: 'monospace' }}>
            {sa.email}
            {sa.disabled && (
              <span style={{ marginLeft: 6, fontSize: 9, color: '#7d8590', border: '1px solid #30363d', borderRadius: 3, padding: '1px 4px' }}>
                DISABLED
              </span>
            )}
          </div>
          {sa.displayName && (
            <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{sa.displayName}</div>
          )}
        </div>
      ))}
    </CollapsibleSection>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ConsoleLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="console-link"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '7px 12px',
        fontSize: 11,
        color: '#58a6ff',
        textDecoration: 'none',
        borderTop: '1px solid #21262d',
        background: 'transparent',
      }}
    >
      Open in GCP Console ↗
    </a>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  function handleClick() {
    navigator.clipboard.writeText(value!);
    setCopied(true);
    addToast('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: '1px solid #21262d',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ color: '#8b949e', flexShrink: 0 }}>{label}</span>
      <span
        onClick={handleClick}
        className="detail-value"
        title="Click to copy"
        role="button"
        aria-label={`Copy ${label} value`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        style={{
          color: copied ? '#3fb950' : '#c9d1d9',
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 11 : undefined,
          textAlign: 'right',
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          cursor: 'copy',
          transition: 'color 0.15s',
        }}
      >
        {copied ? '✓' : value}
      </span>
    </div>
  );
}
