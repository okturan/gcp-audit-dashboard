import { useState, useEffect, useMemo } from 'react';
import { useGCPStore, addToast } from '../store/useGCPStore';
import type { ViewId } from '../store/useGCPStore';
import type { BillingAccount, ProjectDiscovery, APIKey, APIKeyRestrictions } from '../types';
import { computeFindings } from '../utils/findings';

const TIMESTAMP_REFRESH_MS = 30_000;

// ─── Relative-time helper ─────────────────────────────────────────────────────

function relativeTime(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Discovered just now';
  if (diffSec < 60) return `Discovered ${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Discovered ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `Discovered ${diffHr}h ago`;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportJSON(
  rawBillingAccounts: BillingAccount[],
  rawProjects: ProjectDiscovery[],
): void {
  const payload = { billingAccounts: rawBillingAccounts, projects: rawProjects };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `gcp-export-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  addToast('Exported JSON');
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function restrictionType(restrictions: APIKeyRestrictions | undefined): string {
  if (!restrictions) return 'none';
  if (restrictions.browserKeyRestrictions) return 'browser';
  if (restrictions.serverKeyRestrictions) return 'server';
  if (restrictions.apiTargets && restrictions.apiTargets.length > 0) return 'api';
  return 'none';
}

function restrictionTargets(restrictions: APIKeyRestrictions | undefined): string {
  if (!restrictions) return '';
  if (restrictions.browserKeyRestrictions) {
    return restrictions.browserKeyRestrictions.allowedReferrers.join('; ');
  }
  if (restrictions.serverKeyRestrictions) {
    return restrictions.serverKeyRestrictions.allowedIps.join('; ');
  }
  if (restrictions.apiTargets) {
    return restrictions.apiTargets.map((t) => t.service).join('; ');
  }
  return '';
}

function exportCSV(rawProjects: ProjectDiscovery[]): void {
  const projectHeaders = [
    'projectId',
    'name',
    'state',
    'billingEnabled',
    'billingAccount',
    'apiKeyCount',
    'serviceCount',
    'serviceAccounts',
    'iamMembers',
    'requests30d',
    'tokens30d',
    'createdAt',
    'labels',
  ];

  const projectRows = rawProjects.map((pd) => {
    const p = pd.project;
    const iamMemberCount = pd.iamBindings
      ? pd.iamBindings.reduce((sum, b) => sum + b.members.length, 0)
      : 0;
    const labels = p.labels
      ? Object.entries(p.labels)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')
      : '';
    return [
      p.projectId,
      p.displayName,
      p.state,
      pd.billingInfo?.billingEnabled ?? false,
      pd.billingInfo?.billingAccountName ?? '',
      pd.apiKeys.length,
      pd.services.length,
      pd.serviceAccounts?.length ?? 0,
      iamMemberCount,
      pd.usage?.requestCount ?? '',
      pd.usage?.tokenCount ?? '',
      p.createTime,
      labels,
    ].map(csvEscape).join(',');
  });

  const keyHeaders = [
    'keyName',
    'uid',
    'projectId',
    'restrictionType',
    'allowedTargets',
    'createdAt',
    'ageDays',
  ];

  const allKeys: (APIKey & { projectId: string })[] = rawProjects.flatMap((pd) =>
    pd.apiKeys.map((k) => ({ ...k, projectId: pd.project.projectId }))
  );

  const keyRows = allKeys.map((k) => {
    const ageDays = k.createTime
      ? Math.floor((Date.now() - new Date(k.createTime).getTime()) / 86_400_000)
      : '';
    return [
      k.name,
      k.uid,
      k.projectId,
      restrictionType(k.restrictions),
      restrictionTargets(k.restrictions),
      k.createTime,
      ageDays,
    ].map(csvEscape).join(',');
  });

  const lines: string[] = [
    projectHeaders.join(','),
    ...projectRows,
    '',
    keyHeaders.join(','),
    ...keyRows,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `gcp-projects-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  addToast('Exported CSV');
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export function Toolbar() {
  const {
    claudeApiKey,
    setClaudeApiKey,
    discover,
    analyze,
    discoveryState,
    insightState,
    discoveryProgress,
    discoveryWarnings,
    rawProjects,
    rawBillingAccounts,
    signOut,
    gcloudEmail,
    authMethod,
    lastDiscoveredAt,
  } = useGCPStore();

  const isDiscovering = discoveryState === 'loading';
  const isAnalyzing = insightState === 'loading';
  const hasData = rawProjects.length > 0;

  // Relative timestamp label, refreshed every 30 s
  const [timeLabel, setTimeLabel] = useState<string>(() => relativeTime(lastDiscoveredAt));

  useEffect(() => {
    setTimeLabel(relativeTime(lastDiscoveredAt));
    if (!lastDiscoveredAt) return;
    const id = setInterval(() => {
      setTimeLabel(relativeTime(lastDiscoveredAt));
    }, TIMESTAMP_REFRESH_MS);
    return () => clearInterval(id);
  }, [lastDiscoveredAt]);

  const exportBtnStyle: React.CSSProperties = {
    background: '#30363d',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    color: '#e6edf3',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        background: '#161b22',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <span style={{ fontSize: 18 }}>☁️</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>GCP Dashboard</span>
      </div>

      {/* Signed-in badge */}
      <div
        style={{
          background: '#0c1929',
          border: '1px solid #1d4778',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 12,
          color: '#58a6ff',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        <span>
          {authMethod === 'gcloud'
            ? `${gcloudEmail || 'gcloud CLI'}${gcloudEmail ? ' (via gcloud CLI)' : ''}`
            : gcloudEmail || 'Signed in with Google'}
        </span>
        <button
          onClick={signOut}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 14,
            lineHeight: 1,
          }}
          title="Sign out"
          aria-label="Sign out"
        >
          ×
        </button>
      </div>

      {/* Claude key */}
      <input
        type="password"
        className="input-field"
        placeholder="Claude API key (optional)"
        value={claudeApiKey}
        onChange={(e) => setClaudeApiKey(e.target.value)}
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '5px 10px',
          color: '#e6edf3',
          fontSize: 12,
          width: 200,
          fontFamily: 'monospace',
          outline: 'none',
        }}
      />

      {/* Discover */}
      <button
        onClick={discover}
        disabled={isDiscovering}
        className="btn-primary"
        style={{
          background: isDiscovering ? '#1d4778' : '#1f6feb',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          color: '#ffffff',
          fontSize: 13,
          fontWeight: 600,
          cursor: isDiscovering ? 'not-allowed' : 'pointer',
          opacity: isDiscovering ? 0.7 : 1,
          transition: 'filter 0.15s, box-shadow 0.15s',
        }}
      >
        {isDiscovering ? '⏳ Discovering…' : '▶ Discover'}
      </button>

      {/* Analyze */}
      {claudeApiKey && (
        <button
          onClick={analyze}
          disabled={isAnalyzing || !hasData}
          className="btn-purple"
          style={{
            background: isAnalyzing ? '#2d1a5e' : '#6e40c9',
            border: 'none',
            borderRadius: 6,
            padding: '6px 16px',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: isAnalyzing || !hasData ? 'not-allowed' : 'pointer',
            opacity: isAnalyzing || !hasData ? 0.7 : 1,
            transition: 'filter 0.15s, box-shadow 0.15s',
          }}
        >
          {isAnalyzing ? '✨ Analyzing…' : '✨ Analyze'}
        </button>
      )}

      {/* Export buttons — only when data is available */}
      {hasData && (
        <>
          <button
            onClick={() => exportJSON(rawBillingAccounts, rawProjects)}
            className="btn-secondary"
            style={exportBtnStyle}
            title="Export all data as JSON"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportCSV(rawProjects)}
            className="btn-secondary"
            style={exportBtnStyle}
            title="Export projects and API keys as CSV"
          >
            Export CSV
          </button>
        </>
      )}

      {/* Right-side area: stats, progress, timestamp */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        {hasData && !isDiscovering && (
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#8b949e' }}>
            <span title="Projects">{rawProjects.length} projects</span>
            <span style={{ color: '#30363d' }}>|</span>
            <span title="API Keys">{rawProjects.reduce((n, p) => n + p.apiKeys.length, 0)} keys</span>
            <span style={{ color: '#30363d' }}>|</span>
            <span title="Service Accounts">{rawProjects.reduce((n, p) => n + (p.serviceAccounts?.length ?? 0), 0)} SAs</span>
            {discoveryWarnings > 0 && (
              <>
                <span style={{ color: '#30363d' }}>|</span>
                <span
                  title="Some project details could not be loaded — check browser console for details"
                  style={{ color: '#f0883e' }}
                >
                  {discoveryWarnings} partial failure{discoveryWarnings > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        )}
        {discoveryProgress && (
          <span style={{ fontSize: 12, color: '#8b949e' }}>
            {discoveryProgress}
          </span>
        )}
        {timeLabel && !discoveryProgress && (
          <span style={{ fontSize: 12, color: '#7d8590' }}>
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── View Switcher ─────────────────────────────────────────────────────────────

const VIEW_TABS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'graph', label: 'Graph' },
  { id: 'table', label: 'Table' },
  { id: 'charts', label: 'Charts' },
  { id: 'findings', label: 'Findings' },
];

export function ViewSwitcher() {
  const { activeView, setActiveView, rawBillingAccounts, rawProjects, discoveryState } = useGCPStore();

  const findingsCount = useMemo(() => {
    if (discoveryState !== 'success') return 0;
    return computeFindings(rawBillingAccounts, rawProjects).filter((f) => f.severity !== 'green').length;
  }, [rawBillingAccounts, rawProjects, discoveryState]);

  return (
    <div
      style={{
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        padding: '0 16px',
        display: 'flex',
        gap: 2,
        flexShrink: 0,
      }}
    >
      {VIEW_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`view-tab${activeView === tab.id ? ' active' : ''}`}
          onClick={() => setActiveView(tab.id)}
        >
          {tab.label}
          {tab.id === 'findings' && findingsCount > 0 && (
            <span
              style={{
                background: '#f85149',
                color: '#fff',
                borderRadius: 8,
                padding: '0 6px',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: '16px',
              }}
            >
              {findingsCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
