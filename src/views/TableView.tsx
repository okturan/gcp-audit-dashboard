import { useMemo, useState } from 'react';
import { useGCPStore } from '../store/useGCPStore';
import { projectNodeId, apiKeyNodeId } from '../graph/builder';

type SortCol = 'name' | 'state' | 'billing' | 'keys' | 'services' | 'sas' | 'iam' | 'requests' | 'created';
type SortDir = 'asc' | 'desc';

export function TableView() {
  const { rawProjects, discoveryState, discoveryError, selectedNodeId, openDetailDrawer } = useGCPStore();
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');

  const allApiKeys = useMemo(
    () =>
      rawProjects.flatMap((pd) =>
        pd.apiKeys.map((key) => ({
          ...key,
          projectId: pd.project.projectId,
          projectName: pd.project.displayName || pd.project.projectId,
        }))
      ),
    [rawProjects]
  );

  const q = filter.trim().toLowerCase();

  const filteredProjects = useMemo(() => {
    if (!q) return rawProjects;
    return rawProjects.filter((pd) =>
      (pd.project.displayName || '').toLowerCase().includes(q) ||
      pd.project.projectId.toLowerCase().includes(q)
    );
  }, [rawProjects, q]);

  const filteredKeys = useMemo(() => {
    if (!q) return allApiKeys;
    return allApiKeys.filter((k) =>
      (k.displayName || '').toLowerCase().includes(q) ||
      k.uid.toLowerCase().includes(q) ||
      k.projectName.toLowerCase().includes(q)
    );
  }, [allApiKeys, q]);

  const sortedProjects = useMemo(() => {
    const copy = [...filteredProjects];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      switch (sortCol) {
        case 'name': av = (a.project.displayName || a.project.projectId).toLowerCase(); bv = (b.project.displayName || b.project.projectId).toLowerCase(); break;
        case 'state': av = a.project.state; bv = b.project.state; break;
        case 'billing': av = a.billingInfo?.billingEnabled ? 1 : 0; bv = b.billingInfo?.billingEnabled ? 1 : 0; break;
        case 'keys': av = a.apiKeys.length; bv = b.apiKeys.length; break;
        case 'services': av = a.services.length; bv = b.services.length; break;
        case 'sas': av = a.serviceAccounts?.length ?? 0; bv = b.serviceAccounts?.length ?? 0; break;
        case 'iam': av = a.iamBindings?.reduce((n, bi) => n + bi.members.length, 0) ?? 0; bv = b.iamBindings?.reduce((n, bi) => n + bi.members.length, 0) ?? 0; break;
        case 'requests': av = a.usage?.requestCount ?? 0; bv = b.usage?.requestCount ?? 0; break;
        case 'created': av = a.project.createTime || ''; bv = b.project.createTime || ''; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filteredProjects, sortCol, sortDir]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  if (discoveryState !== 'success') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: discoveryError ? '#f85149' : '#7d8590',
          fontSize: 13,
          background: '#0d1117',
          padding: 24,
          textAlign: 'center',
        }}
      >
        {discoveryError ? `Error: ${discoveryError}` : 'Run discovery to see data'}
      </div>
    );
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
    color: '#e6edf3',
  };

  const cellStyle: React.CSSProperties = {
    border: '1px solid #30363d',
    padding: '8px 10px',
    textAlign: 'left',
    verticalAlign: 'top',
  };

  const sortArrow = (col: SortCol) =>
    sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const thStyle = (col: SortCol): React.CSSProperties => ({
    ...cellStyle,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortCol === col ? '#58a6ff' : '#e6edf3',
  });

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#0d1117', padding: '16px 24px 32px' }}>
      {/* Search / filter bar */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="text"
          className="input-field"
          placeholder="Filter projects and keys..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '7px 12px',
            color: '#e6edf3',
            fontSize: 12,
            width: 300,
            maxWidth: '100%',
            outline: 'none',
          }}
        />
        {q && (
          <span style={{ fontSize: 11, color: '#8b949e' }}>
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}, {filteredKeys.length} key{filteredKeys.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
        Projects ({sortedProjects.length})
      </div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#161b22' }}>
            <th style={thStyle('name')} onClick={() => toggleSort('name')}>Project{sortArrow('name')}</th>
            <th style={thStyle('state')} onClick={() => toggleSort('state')}>State{sortArrow('state')}</th>
            <th style={thStyle('billing')} onClick={() => toggleSort('billing')}>Billing{sortArrow('billing')}</th>
            <th style={thStyle('keys')} onClick={() => toggleSort('keys')}>Keys{sortArrow('keys')}</th>
            <th style={thStyle('services')} onClick={() => toggleSort('services')}>Svc{sortArrow('services')}</th>
            <th style={thStyle('sas')} onClick={() => toggleSort('sas')}>SAs{sortArrow('sas')}</th>
            <th style={thStyle('iam')} onClick={() => toggleSort('iam')}>IAM{sortArrow('iam')}</th>
            <th style={thStyle('requests')} onClick={() => toggleSort('requests')}>30d Req{sortArrow('requests')}</th>
            <th style={thStyle('created')} onClick={() => toggleSort('created')}>Created{sortArrow('created')}</th>
            <th style={cellStyle}>Labels</th>
          </tr>
        </thead>
        <tbody>
          {sortedProjects.map((pd, idx) => {
            const nodeId = projectNodeId(pd.project.projectId);
            const labelText = pd.project.labels
              ? Object.entries(pd.project.labels)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(', ')
              : '—';
            const billingText = pd.billingInfo?.billingEnabled
              ? pd.billingInfo.billingAccountName.split('/')[1] || 'Enabled'
              : 'Disabled';
            const totalIamMembers = pd.iamBindings?.reduce((n, b) => n + b.members.length, 0) ?? '—';
            const saCount = pd.serviceAccounts?.length ?? '—';
            const createdDate = pd.project.createTime
              ? new Date(pd.project.createTime).toLocaleDateString()
              : '—';
            return (
              <tr
                key={nodeId}
                className={`table-row${selectedNodeId === nodeId ? ' selected' : ''}`}
                onClick={() => openDetailDrawer(nodeId)}
                style={{
                  background: selectedNodeId === nodeId ? '#1c2d3d' : idx % 2 === 0 ? '#0d1117' : '#161b22',
                  cursor: 'pointer',
                }}
              >
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600 }}>{pd.project.displayName || pd.project.projectId}</div>
                  <div style={{ fontSize: 10, color: '#7d8590', fontFamily: 'monospace' }}>{pd.project.projectId}</div>
                </td>
                <td style={{ ...cellStyle, color: pd.project.state === 'ACTIVE' ? '#3fb950' : '#f85149' }}>
                  {pd.project.state}
                </td>
                <td style={{ ...cellStyle, color: pd.billingInfo?.billingEnabled ? '#3fb950' : '#8b949e' }}>
                  {billingText}
                </td>
                <td style={cellStyle}>{pd.apiKeys.length}</td>
                <td style={cellStyle}>{pd.services.length}</td>
                <td style={cellStyle}>{saCount}</td>
                <td style={cellStyle}>{totalIamMembers}</td>
                <td style={cellStyle}>{pd.usage?.requestCount?.toLocaleString() ?? '—'}</td>
                <td style={cellStyle}>{createdDate}</td>
                <td style={{ ...cellStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={labelText}>{labelText}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ fontSize: 11, color: '#8b949e', margin: '24px 0 8px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
        API Keys ({filteredKeys.length})
      </div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#161b22' }}>
            <th style={cellStyle}>Key Name</th>
            <th style={cellStyle}>Project</th>
            <th style={cellStyle}>Restriction Type</th>
            <th style={cellStyle}>Allowed</th>
            <th style={cellStyle}>Created</th>
            <th style={cellStyle}>Age</th>
          </tr>
        </thead>
        <tbody>
          {filteredKeys.map((key, idx) => {
            const nodeId = apiKeyNodeId(key.uid);
            const r = key.restrictions;
            const isUnrestricted = !r || (!r.apiTargets?.length && !r.browserKeyRestrictions && !r.serverKeyRestrictions);
            const restrictionType = isUnrestricted
              ? '⚠ Unrestricted'
              : r.apiTargets?.length
                ? 'API Targets'
                : r.browserKeyRestrictions
                  ? 'Browser'
                  : 'Server IP';
            const allowed = r?.apiTargets?.length
              ? r.apiTargets.map((t) => t.service).join(', ')
              : r?.browserKeyRestrictions?.allowedReferrers?.join(', ')
                ?? r?.serverKeyRestrictions?.allowedIps?.join(', ')
                ?? '—';
            const createdMs = key.createTime ? new Date(key.createTime).getTime() : undefined;
            const ageDays = createdMs !== undefined ? Math.floor((Date.now() - createdMs) / 86_400_000) : undefined;
            return (
              <tr
                key={nodeId}
                className={`table-row${selectedNodeId === nodeId ? ' selected' : ''}`}
                onClick={() => openDetailDrawer(nodeId)}
                style={{
                  background: selectedNodeId === nodeId ? '#1c2d3d' : idx % 2 === 0 ? '#0d1117' : '#161b22',
                  cursor: 'pointer',
                }}
              >
                <td style={cellStyle}>{key.displayName || key.uid.slice(0, 12) + '…'}</td>
                <td style={cellStyle}>{key.projectName}</td>
                <td style={{ ...cellStyle, color: isUnrestricted ? '#f85149' : '#3fb950' }}>{restrictionType}</td>
                <td style={{ ...cellStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={allowed}>{allowed}</td>
                <td style={cellStyle}>{key.createTime ? new Date(key.createTime).toLocaleDateString() : '—'}</td>
                <td style={cellStyle}>{ageDays !== undefined ? `${ageDays}d` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
