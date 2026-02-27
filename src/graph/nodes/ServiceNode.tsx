import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ServiceNodeType } from '../../types';

export const ServiceNode = memo(function ServiceNode({ data, selected }: NodeProps<ServiceNodeType>) {
  const { service, projectId, insight } = data;
  const svcName = service.config?.name ?? service.name.split('/').pop() ?? 'unknown';
  const title = service.config?.title ?? svcName;
  const consoleUrl = `https://console.cloud.google.com/apis/api/${svcName}/overview?project=${projectId}`;

  const severityColor =
    insight?.severity === 'red'
      ? '#f85149'
      : insight?.severity === 'yellow'
        ? '#f0883e'
        : insight?.severity === 'green'
          ? '#3fb950'
          : undefined;

  return (
    <div
      style={{
        background: '#161b22',
        border: `1px solid ${selected ? '#8b949e' : '#30363d'}`,
        borderRadius: 8,
        padding: '8px 12px',
        width: 200,
        position: 'relative',
        color: '#e6edf3',
        boxShadow: selected ? '0 0 0 1px #8b949e40' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#8b949e' }} />

      {severityColor && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: severityColor,
            border: '2px solid #0d1117',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: 11 }}>⚙</span>
        <span
          style={{ fontSize: 9, fontWeight: 600, color: '#b1bac4', textTransform: 'uppercase', letterSpacing: '0.07em' }}
        >
          Service
        </span>
      </div>

      <div
        style={{
          fontWeight: 500,
          fontSize: 11,
          color: '#c9d1d9',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={title}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 9,
          color: '#b1bac4',
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {svcName}
      </div>

      <a
        href={consoleUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          fontSize: 10,
          color: '#b1bac4',
          textDecoration: 'none',
        }}
        title="Open in GCP Console"
      >
        ↗
      </a>
    </div>
  );
});
