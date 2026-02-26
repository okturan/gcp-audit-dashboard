import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ProjectNodeType } from '../../types';

export const ProjectNode = memo(function ProjectNode({ data, selected }: NodeProps<ProjectNodeType>) {
  const { project, billingInfo, apiKeyCount, serviceCount, services = [], usage, insight, iamBindings, serviceAccounts } = data;
  const iamMemberCount = iamBindings?.reduce((n, b) => n + b.members.length, 0) ?? 0;
  const saCount = serviceAccounts?.length ?? 0;
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const consoleUrl = `https://console.cloud.google.com/home/dashboard?project=${project.projectId}`;

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
        background: '#0c1929',
        border: `2px solid ${selected ? '#58a6ff' : '#1d4778'}`,
        borderRadius: 10,
        padding: '10px 14px',
        width: 280,
        color: '#e6edf3',
        boxShadow: selected ? '0 0 0 1px #58a6ff40, 0 4px 16px #58a6ff20' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#58a6ff' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#58a6ff' }} />

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
        <span style={{ fontSize: 13 }}>🗂</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#58a6ff',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          PROJECT
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: billingInfo?.billingEnabled ? '#0f2318' : '#1c1c1c',
            color: billingInfo?.billingEnabled ? '#3fb950' : '#8b949e',
          }}
        >
          {billingInfo?.billingEnabled ? 'BILLING ON' : 'NO BILLING'}
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
        title={project.displayName || project.projectId}
      >
        {project.displayName || project.projectId}
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#8b949e',
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {project.projectId}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontSize: 10, color: '#8b949e' }}>
        {apiKeyCount > 0 && <span>🔑 {apiKeyCount} keys</span>}
        {saCount > 0 && <span>🤖 {saCount} SAs</span>}
        {iamMemberCount > 0 && <span>🔒 {iamMemberCount} IAM</span>}
        {usage?.requestCount !== undefined && (
          <span>📊 {usage.requestCount.toLocaleString()} req</span>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setServicesExpanded((v) => !v);
        }}
        aria-expanded={servicesExpanded}
        aria-label={`${servicesExpanded ? 'Collapse' : 'Expand'} ${serviceCount} services`}
        style={{
          marginTop: 6,
          border: 'none',
          background: 'transparent',
          padding: 0,
          fontSize: 10,
          color: '#8b949e',
          cursor: 'pointer',
          textDecoration: 'none',
        }}
      >
        {servicesExpanded ? '▾' : '▸'} {serviceCount} services
      </button>

      {servicesExpanded && (
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {services.map((service) => {
            const name = service.config?.name ?? service.name.split('/').pop() ?? 'unknown';
            return (
              <span
                key={`${project.projectId}-${name}`}
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
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <a
          href={consoleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="node-console-link"
          style={{
            fontSize: 11,
            color: '#8b949e',
            textDecoration: 'none',
          }}
          title="Open in GCP Console"
        >
          ↗
        </a>
      </div>
    </div>
  );
});
