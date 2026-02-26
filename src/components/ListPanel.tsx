import { useMemo, useRef, useEffect, useState } from 'react';
import { useGCPStore } from '../store/useGCPStore';
import type { BillingAccount, GCPProject } from '../types';
import { billingNodeId, projectNodeId, apiKeyNodeId } from '../graph/builder';

type ListTab = 'billing' | 'projects' | 'keys';

export function ListPanel() {
  const {
    rawBillingAccounts,
    rawProjects,
    selectedNodeId,
    panToNode,
    discoveryState,
    discoveryError,
    searchQuery: query,
    setSearchQuery: setQuery,
  } = useGCPStore();

  const q = query.trim().toLowerCase();
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+F / Cmd+F to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // All hooks must be before any early return (React rules of hooks)
  const allApiKeys = useMemo(
    () =>
      rawProjects.flatMap((pd) =>
        pd.apiKeys.map((k) => ({
          ...k,
          projectName: pd.project.displayName || pd.project.projectId,
        }))
      ),
    [rawProjects]
  );

  const filteredBilling = useMemo(
    () =>
      q
        ? rawBillingAccounts.filter(
            (ba: BillingAccount) =>
              ba.displayName.toLowerCase().includes(q) || ba.name.toLowerCase().includes(q)
          )
        : rawBillingAccounts,
    [q, rawBillingAccounts]
  );

  const filteredProjects = useMemo(
    () =>
      q
        ? rawProjects.filter(
            (pd) =>
              (pd.project.displayName || '').toLowerCase().includes(q) ||
              pd.project.projectId.toLowerCase().includes(q)
          )
        : rawProjects,
    [q, rawProjects]
  );

  const filteredKeys = useMemo(
    () =>
      q
        ? allApiKeys.filter(
            (k) =>
              (k.displayName || '').toLowerCase().includes(q) ||
              k.uid.toLowerCase().includes(q) ||
              k.projectName.toLowerCase().includes(q)
          )
        : allApiKeys,
    [q, allApiKeys]
  );

  const [activeTab, setActiveTab] = useState<ListTab>('projects');

  // Auto-select tab that matches a newly selected node
  useEffect(() => {
    if (!selectedNodeId) return;
    if (selectedNodeId.startsWith('billing-')) setActiveTab('billing');
    else if (selectedNodeId.startsWith('project-')) setActiveTab('projects');
    else if (selectedNodeId.startsWith('apikey-')) setActiveTab('keys');
  }, [selectedNodeId]);

  if (discoveryState !== 'success') {
    return (
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#161b22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <span style={{ color: discoveryError ? '#f85149' : '#7d8590', fontSize: 12, textAlign: 'center' }}>
          {discoveryError ? `Error: ${discoveryError}` : 'No data yet'}
        </span>
      </div>
    );
  }

  const rowStyle = (nodeId: string): React.CSSProperties => ({
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    color: selectedNodeId === nodeId ? '#e6edf3' : '#8b949e',
    background: selectedNodeId === nodeId ? '#1c2d3d' : 'transparent',
    borderLeft: `2px solid ${selectedNodeId === nodeId ? '#58a6ff' : 'transparent'}`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  const tabs: { id: ListTab; label: string; ariaLabel: string; count: number; filtered: number }[] = [
    { id: 'billing', label: '💳', ariaLabel: 'Billing accounts', count: rawBillingAccounts.length, filtered: filteredBilling.length },
    { id: 'projects', label: '🗂', ariaLabel: 'Projects', count: rawProjects.length, filtered: filteredProjects.length },
    { id: 'keys', label: '🔑', ariaLabel: 'API keys', count: allApiKeys.length, filtered: filteredKeys.length },
  ];

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tab bar + search */}
      <div style={{ flexShrink: 0, background: '#161b22' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #21262d' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={`${tab.ariaLabel} (${q ? `${tab.filtered} of ${tab.count}` : tab.count})`}
              aria-selected={activeTab === tab.id}
              style={{
                flex: 1,
                background: activeTab === tab.id ? '#0d1117' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #58a6ff' : '2px solid transparent',
                padding: '6px 4px',
                cursor: 'pointer',
                fontSize: 11,
                color: activeTab === tab.id ? '#e6edf3' : '#8b949e',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span>{tab.label}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {q ? `${tab.filtered}/${tab.count}` : tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div
          style={{
            padding: '6px 10px',
            borderBottom: '1px solid #21262d',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            ref={searchRef}
            type="text"
            className="input-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search… (Ctrl+F)"
            style={{
              width: '100%',
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '5px 10px',
              paddingRight: query ? 28 : 10,
              fontSize: 11,
              color: '#e6edf3',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              title="Clear search"
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 18,
                background: 'none',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list — one section at a time */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'billing' && (
          filteredBilling.length > 0 ? (
            filteredBilling.map((ba: BillingAccount) => {
              const nid = billingNodeId(ba);
              return (
                <div
                  key={nid}
                  className={`list-row${selectedNodeId === nid ? ' selected' : ''}`}
                  style={rowStyle(nid)}
                  onClick={() => panToNode(nid)}
                >
                  <span>💳</span>
                  <span>{ba.displayName || ba.name.split('/')[1]}</span>
                </div>
              );
            })
          ) : (
            <div style={emptyStyle}>{q ? `No billing accounts match "${query}"` : 'No billing accounts'}</div>
          )
        )}

        {activeTab === 'projects' && (
          filteredProjects.length > 0 ? (
            filteredProjects.map(({ project }: { project: GCPProject }) => {
              const nid = projectNodeId(project.projectId);
              return (
                <div
                  key={nid}
                  className={`list-row${selectedNodeId === nid ? ' selected' : ''}`}
                  style={rowStyle(nid)}
                  onClick={() => panToNode(nid)}
                >
                  <span>🗂</span>
                  <span>{project.displayName || project.projectId}</span>
                </div>
              );
            })
          ) : (
            <div style={emptyStyle}>{q ? `No projects match "${query}"` : 'No projects'}</div>
          )
        )}

        {activeTab === 'keys' && (
          filteredKeys.length > 0 ? (
            filteredKeys.map((key) => {
              const nid = apiKeyNodeId(key.uid);
              return (
                <div
                  key={nid}
                  className={`list-row${selectedNodeId === nid ? ' selected' : ''}`}
                  style={rowStyle(nid)}
                  onClick={() => panToNode(nid)}
                >
                  <span>🔑</span>
                  <span>{key.displayName || key.uid.slice(0, 12)}</span>
                  <span style={{ color: '#7d8590', fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
                    {key.projectName}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={emptyStyle}>{q ? `No keys match "${query}"` : 'No API keys'}</div>
          )
        )}
      </div>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  fontSize: 12,
  color: '#7d8590',
  textAlign: 'center',
};
