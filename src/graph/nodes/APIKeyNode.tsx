import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { APIKeyNodeType } from '../../types';

export const APIKeyNode = memo(function APIKeyNode({ data, selected }: NodeProps<APIKeyNodeType>) {
  const { apiKey, projectId, insight } = data;
  const consoleUrl = `https://console.cloud.google.com/apis/credentials?project=${projectId}`;

  const r = apiKey.restrictions;
  const restrictions = r?.apiTargets?.map((t) => t.service).join(', ');
  const isUnrestricted = !r || (!r.apiTargets?.length && !r.browserKeyRestrictions && !r.serverKeyRestrictions);

  const severityColor =
    insight?.severity === 'red'
      ? '#f85149'
      : insight?.severity === 'yellow'
        ? '#f0883e'
        : insight?.severity === 'green'
          ? '#3fb950'
          : undefined;

  const createdDate = apiKey.createTime
    ? new Date(apiKey.createTime).toLocaleDateString()
    : '—';

  const ageDays = apiKey.createTime
    ? Math.floor((Date.now() - new Date(apiKey.createTime).getTime()) / 86_400_000)
    : undefined;
  const ageWarning = ageDays !== undefined && ageDays > 180 ? 'red' : ageDays !== undefined && ageDays > 90 ? 'yellow' : null;

  return (
    <div
      style={{
        background: '#0c1f13',
        border: `2px solid ${selected ? '#3fb950' : '#1a4a28'}`,
        borderRadius: 10,
        padding: '10px 14px',
        width: 220,
        position: 'relative',
        color: '#e6edf3',
        boxShadow: selected ? '0 0 0 1px #3fb95040, 0 4px 16px #3fb95020' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#3fb950' }} />

      {severityColor && (
        <div
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: severityColor,
            border: '2px solid #0d1117',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>🔑</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#3fb950',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          API Key
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {isUnrestricted && (
            <span
              style={{
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 4,
                background: '#2d0f0f',
                color: '#f85149',
                border: '1px solid #5a1d1d',
              }}
            >
              ⚠ Unrestricted
            </span>
          )}
          {ageWarning && ageDays !== undefined && (
            <span
              style={{
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 4,
                background: ageWarning === 'red' ? '#2d0f0f' : '#2d1a00',
                color: ageWarning === 'red' ? '#f85149' : '#f0883e',
                border: `1px solid ${ageWarning === 'red' ? '#5a1d1d' : '#5a3a00'}`,
              }}
            >
              {ageDays}d old
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          fontWeight: 600,
          fontSize: 12,
          color: '#e6edf3',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={apiKey.displayName}
      >
        {apiKey.displayName || apiKey.uid.slice(0, 12) + '…'}
      </div>

      {restrictions && (
        <div
          style={{
            fontSize: 10,
            color: '#8b949e',
            marginTop: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={restrictions}
        >
          {restrictions}
        </div>
      )}
      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 3 }}>Created {createdDate}</div>

      <a
        href={consoleUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="node-console-link"
        style={{
          position: 'absolute',
          bottom: 8,
          right: 10,
          fontSize: 11,
          color: '#8b949e',
          textDecoration: 'none',
        }}
        title="Open in GCP Console"
      >
        ↗
      </a>
    </div>
  );
});
