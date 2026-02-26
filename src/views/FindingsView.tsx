import { useMemo, useState } from 'react';
import { useGCPStore } from '../store/useGCPStore';
import { computeFindings, type Severity } from '../utils/findings';

const SEV_COLOR: Record<Severity, string> = {
  red: '#f85149',
  yellow: '#f0883e',
  green: '#3fb950',
};
const SEV_BG: Record<Severity, string> = {
  red: '#2d0f0f',
  yellow: '#2d1a00',
  green: '#0f2318',
};

type FilterSev = 'all' | 'red' | 'yellow';

export function FindingsView() {
  const { rawBillingAccounts, rawProjects, discoveryState, openDetailDrawer, selectedNodeId } =
    useGCPStore();
  const [sevFilter, setSevFilter] = useState<FilterSev>('all');

  const findings = useMemo(
    () => computeFindings(rawBillingAccounts, rawProjects),
    [rawBillingAccounts, rawProjects]
  );

  const filtered = useMemo(
    () => sevFilter === 'all' ? findings : findings.filter((f) => f.severity === sevFilter),
    [findings, sevFilter]
  );

  if (discoveryState !== 'success') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7d8590',
          fontSize: 13,
          background: '#0d1117',
        }}
      >
        Run discovery to see findings
      </div>
    );
  }

  const redCount = findings.filter((f) => f.severity === 'red').length;
  const yellowCount = findings.filter((f) => f.severity === 'yellow').length;

  function exportFindings() {
    const lines = [
      'severity,title,body',
      ...findings.map((f) => {
        const esc = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        return `${f.severity},${esc(f.title)},${esc(f.body)}`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcp-findings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#21262d' : 'transparent',
    border: '1px solid',
    borderColor: active ? '#30363d' : 'transparent',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    color: active ? '#e6edf3' : '#8b949e',
  });

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '12px 24px',
          background: '#161b22',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: redCount > 0 ? '#f85149' : '#7d8590', fontWeight: 600, fontSize: 12 }}>
          {redCount} critical
        </span>
        <span style={{ color: yellowCount > 0 ? '#f0883e' : '#7d8590', fontWeight: 600, fontSize: 12 }}>
          {yellowCount} warning
        </span>
        {findings.length === 0 && (
          <span style={{ color: '#3fb950', fontWeight: 600, fontSize: 12 }}>All clear</span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setSevFilter('all')} style={filterBtnStyle(sevFilter === 'all')}>All</button>
          <button onClick={() => setSevFilter('red')} style={filterBtnStyle(sevFilter === 'red')}>Critical</button>
          <button onClick={() => setSevFilter('yellow')} style={filterBtnStyle(sevFilter === 'yellow')}>Warning</button>
          {findings.length > 0 && (
            <button
              onClick={exportFindings}
              className="btn-secondary"
              style={{
                marginLeft: 8,
                background: '#30363d',
                border: 'none',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 11,
                color: '#8b949e',
                cursor: 'pointer',
              }}
              title="Export findings as CSV"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {/* Findings list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {findings.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#3fb950', fontSize: 14 }}>
            No issues detected
          </div>
        )}
        {findings.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: '#7d8590', fontSize: 13 }}>
            No findings match this filter
          </div>
        )}

        {filtered.map((f, i) => (
          <div
            key={i}
            className={`finding-row${selectedNodeId === f.nodeId ? ' selected' : ''}`}
            onClick={() => openDetailDrawer(f.nodeId)}
            style={{
              padding: '12px 24px',
              borderBottom: '1px solid #21262d',
              borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
              background: selectedNodeId === f.nodeId ? '#1c2d3d' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: SEV_COLOR[f.severity],
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  background: SEV_BG[f.severity],
                  borderRadius: 3,
                  padding: '1px 6px',
                  marginRight: 8,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {f.severity}
              </span>
              {f.title}
            </div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>{f.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
