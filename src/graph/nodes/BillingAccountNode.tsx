import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BillingAccountNodeType } from '../../types';

export const BillingAccountNode = memo(function BillingAccountNode({ data, selected }: NodeProps<BillingAccountNodeType>) {
  const { billingAccount: ba, projectCount = 0, insight } = data;
  const accountId = ba.name.split('/')[1] ?? ba.name;
  const consoleUrl = `https://console.cloud.google.com/billing/${accountId}`;

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
        background: '#1c1a0e',
        border: `2px solid ${selected ? '#f59e0b' : '#92400e'}`,
        borderRadius: 10,
        padding: '10px 14px',
        width: 260,
        position: 'relative',
        color: '#e6edf3',
        boxShadow: selected ? '0 0 0 1px #f59e0b40, 0 4px 16px #f59e0b20' : undefined,
      }}
    >
      <Handle type="source" position={Position.Bottom} style={{ background: '#d97706' }} />

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
        <span style={{ fontSize: 13 }}>💳</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#d97706',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          Billing Account
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: ba.open ? '#0f2318' : '#2d0f0f',
            color: ba.open ? '#3fb950' : '#f85149',
          }}
        >
          {ba.open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          color: '#e6edf3',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={ba.displayName}
      >
        {ba.displayName || accountId}
      </div>
      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 3 }}>
        {accountId}
      </div>
      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
        Currency: {ba.currencyCode}
      </div>
      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
      </div>

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
