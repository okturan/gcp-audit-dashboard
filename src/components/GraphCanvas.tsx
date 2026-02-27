import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AppNode } from '../types';
import { useGCPStore, addToast } from '../store/useGCPStore';
import { BillingAccountNode } from '../graph/nodes/BillingAccountNode';
import { ProjectNode } from '../graph/nodes/ProjectNode';
import { APIKeyNode } from '../graph/nodes/APIKeyNode';
import { ServiceNode } from '../graph/nodes/ServiceNode';

const nodeTypes: NodeTypes = {
  billingAccount: BillingAccountNode as NodeTypes[string],
  project: ProjectNode as NodeTypes[string],
  apiKey: APIKeyNode as NodeTypes[string],
  service: ServiceNode as NodeTypes[string],
};

const FIT_VIEW_DELAY = 50;

// Inner component — must be inside ReactFlowProvider to use useReactFlow
function FlowInner({ onContextMenu }: { onContextMenu?: (ctx: { x: number; y: number; nodeId: string } | null) => void }) {
  const { nodes: allNodes, edges: rawEdges, selectedNodeId, setSelectedNodeId, fitViewTrigger, panToId, searchQuery, hiddenNodeTypes } = useGCPStore();
  const { fitView } = useReactFlow();
  const prevTrigger = useRef(fitViewTrigger);
  const prevPanToId = useRef(panToId);

  // Filter hidden node types
  const hiddenNodeIds = useMemo(() => {
    if (hiddenNodeTypes.size === 0) return null;
    const ids = new Set<string>();
    for (const n of allNodes) if (hiddenNodeTypes.has(n.type ?? '')) ids.add(n.id);
    return ids;
  }, [allNodes, hiddenNodeTypes]);

  const nodes = useMemo(
    () => hiddenNodeIds ? allNodes.filter((n) => !hiddenNodeIds.has(n.id)) : allNodes,
    [allNodes, hiddenNodeIds]
  );

  const filteredEdges = useMemo(
    () => hiddenNodeIds
      ? rawEdges.filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target))
      : rawEdges,
    [rawEdges, hiddenNodeIds]
  );

  // Color edges by source node type; highlight edges touching selected node
  const nodeTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) m.set(n.id, n.type ?? 'project');
    return m;
  }, [nodes]);

  // Set of node IDs connected to the selected node (for dimming)
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const ids = new Set<string>([selectedNodeId]);
    for (const e of filteredEdges) {
      if (e.source === selectedNodeId) ids.add(e.target);
      if (e.target === selectedNodeId) ids.add(e.source);
    }
    return ids;
  }, [selectedNodeId, filteredEdges]);

  const edges = useMemo(() => filteredEdges.map((e) => {
    const sourceType = nodeTypeMap.get(e.source);
    const isHighlighted = selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);
    const baseColor = sourceType === 'billingAccount' ? '#b45309' : '#1d4778';
    return {
      ...e,
      type: 'smoothstep',
      style: {
        stroke: isHighlighted ? '#58a6ff' : baseColor,
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        opacity: selectedNodeId && !isHighlighted ? 0.3 : 1,
        transition: 'stroke 0.2s, opacity 0.2s, stroke-width 0.2s',
      },
      animated: isHighlighted ? true : false,
    };
  }), [filteredEdges, nodeTypeMap, selectedNodeId]);

  // Compute search-matching node IDs
  const searchMatchIds = useMemo(() => {
    const sq = searchQuery.trim().toLowerCase();
    if (!sq) return null;
    const ids = new Set<string>();
    for (const n of nodes) {
      const text = getNodeSearchText(n);
      if (text.toLowerCase().includes(sq)) ids.add(n.id);
    }
    return ids.size > 0 ? ids : null;
  }, [nodes, searchQuery]);

  // Dim unrelated nodes when something is selected or search is active
  const styledNodes = useMemo(() => {
    if (!connectedNodeIds && !searchMatchIds) return nodes;
    return nodes.map((n) => {
      let opacity = 1;
      if (connectedNodeIds && !connectedNodeIds.has(n.id)) opacity = 0.3;
      if (searchMatchIds) {
        // Search takes visual priority: matching nodes glow, non-matching dim
        opacity = searchMatchIds.has(n.id) ? 1 : 0.2;
      }
      return {
        ...n,
        style: {
          ...n.style,
          opacity,
          transition: 'opacity 0.2s',
          ...(searchMatchIds?.has(n.id) ? { filter: 'drop-shadow(0 0 6px #58a6ff)' } : {}),
        },
      };
    });
  }, [nodes, connectedNodeIds, searchMatchIds]);

  useEffect(() => {
    if (fitViewTrigger !== prevTrigger.current) {
      prevTrigger.current = fitViewTrigger;
      setTimeout(() => fitView({ padding: 0.12, duration: 400 }), FIT_VIEW_DELAY);
    }
  }, [fitViewTrigger, fitView]);

  useEffect(() => {
    if (panToId && panToId !== prevPanToId.current) {
      prevPanToId.current = panToId;
      setTimeout(() => {
        fitView({ nodes: [{ id: panToId }], padding: 0.4, duration: 500, maxZoom: 1.5 });
        useGCPStore.setState({ panToId: null });
      }, FIT_VIEW_DELAY);
    }
  }, [panToId, fitView]);

  const onNodeClick: NodeMouseHandler<AppNode> = useCallback(
    (_event, node) => setSelectedNodeId(node.id),
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => setSelectedNodeId(null), [setSelectedNodeId]);

  // Double-click to focus on a subtree (the node + its children)
  const onNodeDoubleClick: NodeMouseHandler<AppNode> = useCallback((_event, node) => {
    const subtreeIds = [node.id];
    for (const e of filteredEdges) {
      if (e.source === node.id) subtreeIds.push(e.target);
    }
    fitView({ nodes: subtreeIds.map((id) => ({ id })), padding: 0.3, duration: 500, maxZoom: 1.5 });
  }, [filteredEdges, fitView]);

  // Stable MiniMap color callback
  const miniMapNodeColor = useCallback((node: AppNode) => {
    if (node.id === selectedNodeId) return '#58a6ff';
    if (node.type === 'billingAccount') return '#d97706';
    if (node.type === 'project') return '#1f6feb';
    if (node.type === 'apiKey') return '#3fb950';
    return '#484f58';
  }, [selectedNodeId]);

  // Hover tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onNodeMouseEnter: NodeMouseHandler<AppNode> = useCallback((_event, node) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      const text = getNodeTooltipText(node);
      if (text) {
        const rect = (_event.target as HTMLElement).closest('.react-flow__node')?.getBoundingClientRect();
        if (rect) setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, text });
      }
    }, 400);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }, []);

  // Clean up tooltip timer on unmount
  useEffect(() => {
    return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); };
  }, []);

  // Right-click context menu
  const onNodeContextMenu: NodeMouseHandler<AppNode> = useCallback((event, node) => {
    event.preventDefault();
    onContextMenu?.({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, [onContextMenu]);

  // Sorted node IDs for keyboard navigation (stored in ref to avoid re-subscribing the listener)
  const sortedNodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const sortedNodeIdsRef = useRef(sortedNodeIds);
  useEffect(() => { sortedNodeIdsRef.current = sortedNodeIds; }, [sortedNodeIds]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle keyboard nav when graph view is active
      if (useGCPStore.getState().activeView !== 'graph') return;
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const ids = sortedNodeIdsRef.current;
        const { selectedNodeId } = useGCPStore.getState();
        if (ids.length === 0) return;
        if (!selectedNodeId) {
          // Select first node
          const id = ids[0];
          useGCPStore.getState().panToNode(id);
          return;
        }
        const idx = ids.indexOf(selectedNodeId);
        const next = e.key === 'ArrowDown'
          ? ids[(idx + 1) % ids.length]
          : ids[(idx - 1 + ids.length) % ids.length];
        useGCPStore.getState().panToNode(next);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedNodeId]);

  return (
    <>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeContextMenu={onNodeContextMenu}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#21262d" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(13,17,23,0.85)"
          zoomable
          pannable
        />
      </ReactFlow>
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 10,
            color: '#e6edf3',
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            maxWidth: 240,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>

  );
}

export function GraphCanvas() {
  const { discoveryState, discoveryError, discoveryProgress, discoveryTotal, discoveryDone } = useGCPStore();

  // All hooks must be called unconditionally (React rules of hooks)
  const [showHelp, setShowHelp] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  if (discoveryState === 'idle') {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
        <p style={{ color: '#8b949e', fontSize: 14 }}>
          Click <strong style={{ color: '#e6edf3' }}>▶ Discover</strong> to scan your GCP account
        </p>
      </div>
    );
  }

  if (discoveryState === 'loading') {
    const pct = discoveryTotal > 0 ? Math.round((discoveryDone / discoveryTotal) * 100) : 0;
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 12 }}>{discoveryProgress || 'Discovering…'}</p>
        <div style={{ width: 280, maxWidth: '80%' }}>
          {discoveryTotal > 0 ? (
            <>
              <div style={{
                height: 6,
                background: '#21262d',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: '#1f6feb',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
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

  if (discoveryState === 'error') {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>❌</div>
        <p style={{ color: '#f85149', fontSize: 14, maxWidth: 480, textAlign: 'center' }}>
          {discoveryError}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, background: '#0d1117', position: 'relative' }}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      <FlowInner onContextMenu={setContextMenu} />

      {/* Legend + Node Type Filters */}
      <NodeTypeLegend />

      {/* Context menu */}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} nodeId={contextMenu.nodeId} onClose={() => setContextMenu(null)} />}

      {/* Help button */}
      <button
        onClick={() => setShowHelp((v) => !v)}
        className="btn-ghost"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#161b22',
          border: '1px solid #30363d',
          color: '#8b949e',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
      >
        ?
      </button>
      {showHelp && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 12,
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 11,
            color: '#e6edf3',
            zIndex: 20,
            minWidth: 200,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#8b949e', textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.07em' }}>
            Keyboard Shortcuts
          </div>
          {[
            ['Esc', 'Deselect node'],
            ['Arrow Up/Down', 'Cycle through nodes'],
            ['Ctrl+F', 'Focus search'],
            ['Double-click', 'Focus subtree'],
            ['Right-click', 'Node context menu'],
            ['Click value', 'Copy to clipboard'],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <kbd style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 3, padding: '1px 5px', fontSize: 10, color: '#58a6ff', fontFamily: 'monospace' }}>
                {key}
              </kbd>
              <span style={{ color: '#8b949e' }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Node Type Legend + Filter ────────────────────────────────────────────────

const NODE_TYPE_COLORS: [string, string, string][] = [
  ['billingAccount', '#d97706', 'Billing'],
  ['project', '#1f6feb', 'Project'],
  ['apiKey', '#3fb950', 'API Key'],
];

function NodeTypeLegend() {
  const { hiddenNodeTypes, toggleNodeType, nodes: allNodes, bumpFitView } = useGCPStore();

  // Count nodes per type
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of allNodes) m.set(n.type ?? '', (m.get(n.type ?? '') ?? 0) + 1);
    return m;
  }, [allNodes]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'rgba(22,27,34,0.92)',
        border: '1px solid #30363d',
        borderRadius: 8,
        padding: '8px 10px',
        zIndex: 20,
        display: 'flex',
        gap: 8,
        fontSize: 10,
        alignItems: 'center',
      }}
    >
      {NODE_TYPE_COLORS.map(([type, color, label]) => {
        const hidden = hiddenNodeTypes.has(type);
        const count = counts.get(type) ?? 0;
        return (
          <button
            key={type}
            onClick={() => toggleNodeType(type)}
            className="legend-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: hidden ? '#7d8590' : '#8b949e',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '2px 4px',
              borderRadius: 4,
              fontSize: 10,
              textDecoration: hidden ? 'line-through' : 'none',
              opacity: hidden ? 0.5 : 1,
            }}
            title={hidden ? `Show ${label} nodes` : `Hide ${label} nodes`}
            aria-label={hidden ? `Show ${label} nodes` : `Hide ${label} nodes`}
            aria-pressed={!hidden}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hidden ? '#30363d' : color,
                display: 'inline-block',
                transition: 'background 0.15s',
              }}
            />
            {label}
            {count > 0 && (
              <span style={{ color: hidden ? '#30363d' : '#7d8590', fontSize: 9 }}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
      {/* Fit All button */}
      <button
        onClick={bumpFitView}
        className="btn-ghost"
        style={{
          background: 'none',
          border: '1px solid #30363d',
          borderRadius: 4,
          padding: '2px 8px',
          color: '#8b949e',
          cursor: 'pointer',
          fontSize: 10,
          marginLeft: 4,
        }}
        title="Fit all nodes in view"
        aria-label="Fit all nodes in view"
      >
        Fit All
      </button>
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function getNodeLabel(node: AppNode): string {
  switch (node.type) {
    case 'billingAccount': return node.data.billingAccount.displayName;
    case 'project': return node.data.project.displayName || node.data.project.projectId;
    case 'apiKey': return node.data.apiKey.displayName || node.data.apiKey.uid;
    case 'service': return node.data.service.config?.name ?? '';
  }
}

function getNodeSearchText(node: AppNode): string {
  switch (node.type) {
    case 'billingAccount': return node.data.billingAccount.displayName;
    case 'project': return `${node.data.project.displayName} ${node.data.project.projectId}`;
    case 'apiKey': return `${node.data.apiKey.displayName} ${node.data.apiKey.uid}`;
    case 'service': return node.data.service.config?.name ?? '';
  }
}

function getNodeTooltipText(node: AppNode): string {
  switch (node.type) {
    case 'billingAccount': {
      const d = node.data;
      return `${d.billingAccount.displayName}\n${d.billingAccount.open ? 'Open' : 'Closed'} · ${d.projectCount ?? 0} projects`;
    }
    case 'project': {
      const d = node.data;
      let text = `${d.project.displayName || d.project.projectId}\n${d.apiKeyCount} keys · ${d.serviceCount} services`;
      if (d.usage?.requestCount) text += `\n${d.usage.requestCount.toLocaleString()} req/30d`;
      return text;
    }
    case 'apiKey': {
      const d = node.data;
      const r = d.apiKey.restrictions;
      const unrestricted = !r || (!r.apiTargets?.length && !r.browserKeyRestrictions && !r.serverKeyRestrictions);
      return `${d.apiKey.displayName || d.apiKey.uid.slice(0, 12)}\n${unrestricted ? 'Unrestricted' : 'Restricted'}`;
    }
    case 'service':
      return '';
  }
}

function getConsoleUrl(node: AppNode): string {
  switch (node.type) {
    case 'billingAccount': {
      const accountId = node.data.billingAccount.name.split('/')[1];
      return `https://console.cloud.google.com/billing/${accountId}`;
    }
    case 'project':
      return `https://console.cloud.google.com/home/dashboard?project=${node.data.project.projectId}`;
    case 'apiKey':
      return `https://console.cloud.google.com/apis/credentials?project=${node.data.projectId}`;
    case 'service': {
      const svcName = node.data.service.config?.name ?? node.data.service.name.split('/').pop();
      return `https://console.cloud.google.com/apis/api/${svcName}/overview?project=${node.data.projectId}`;
    }
  }
}

function getNodeCopyId(node: AppNode): string {
  switch (node.type) {
    case 'billingAccount': return node.data.billingAccount.name;
    case 'project': return node.data.project.projectId;
    case 'apiKey': return node.data.apiKey.uid;
    case 'service': return node.data.service.config?.name ?? '';
  }
}

function ContextMenu({ x, y, nodeId, onClose }: { x: number; y: number; nodeId: string; onClose: () => void }) {
  const { nodes, edges, panToNode } = useGCPStore();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const consoleUrl = getConsoleUrl(node);
  const copyId = getNodeCopyId(node);

  const items: { label: string; action: () => void }[] = [];

  items.push({
    label: `Copy ID: ${copyId.length > 28 ? copyId.slice(0, 26) + '…' : copyId}`,
    action: () => { navigator.clipboard.writeText(copyId); addToast('Copied ID to clipboard'); onClose(); },
  });

  items.push({
    label: 'Open in GCP Console',
    action: () => { window.open(consoleUrl, '_blank', 'noopener'); onClose(); },
  });

  // Focus subtree
  const childIds = edges.filter((e) => e.source === nodeId).map((e) => e.target);
  if (childIds.length > 0) {
    items.push({
      label: `Focus subtree (${childIds.length} children)`,
      action: () => {
        panToNode(nodeId);
        onClose();
      },
    });
  }

  // Copy node label
  const label = getNodeLabel(node);

  if (label) {
    items.push({
      label: 'Copy name',
      action: () => { navigator.clipboard.writeText(label); addToast('Copied name to clipboard'); onClose(); },
    });
  }

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '4px 0',
    zIndex: 200,
    minWidth: 180,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  };

  const itemStyle: React.CSSProperties = {
    padding: '7px 14px',
    fontSize: 11,
    color: '#e6edf3',
    cursor: 'pointer',
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    textAlign: 'left',
  };

  return (
    <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <button
          key={item.label}
          className="ctx-menu-item"
          style={itemStyle}
          onClick={item.action}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0d1117',
  color: '#e6edf3',
};
