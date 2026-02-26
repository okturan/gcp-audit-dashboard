import { useEffect, useRef, useState, useCallback } from 'react';
import { GraphCanvas } from '../components/GraphCanvas';
import { ListPanel } from '../components/ListPanel';
import { DetailPanel } from '../components/DetailPanel';

const MIN_PANEL = 260;
const MAX_PANEL = 900;
const DEFAULT_PANEL = 360;
const DEFAULT_SPLIT = 0.45;
const MIN_SPLIT = 0.2;
const MAX_SPLIT = 0.85;

function getSavedPanelWidth(): number {
  try { const v = localStorage.getItem('gcp-panel-width'); return v ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, Number(v))) : DEFAULT_PANEL; }
  catch { return DEFAULT_PANEL; }
}

function getSavedSplit(): number {
  try { const v = localStorage.getItem('gcp-panel-split'); return v ? Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, Number(v))) : DEFAULT_SPLIT; }
  catch { return DEFAULT_SPLIT; }
}

export function GraphView() {
  const [panelWidth, setPanelWidth] = useState(getSavedPanelWidth);
  const [splitRatio, setSplitRatio] = useState(getSavedSplit);
  const dragging = useRef<'h' | 'v' | false>(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startWidth = useRef(DEFAULT_PANEL);
  const startSplit = useRef(DEFAULT_SPLIT);
  const panelRef = useRef<HTMLDivElement>(null);

  const onHDragDown = useCallback((e: React.MouseEvent) => {
    dragging.current = 'h';
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    e.preventDefault();
  }, [panelWidth]);

  const onVDragDown = useCallback((e: React.MouseEvent) => {
    dragging.current = 'v';
    startY.current = e.clientY;
    startSplit.current = splitRatio;
    e.preventDefault();
  }, [splitRatio]);

  useEffect(() => {
    let lastWidth = 0;
    let lastSplit = 0;
    const onMove = (e: MouseEvent) => {
      if (dragging.current === 'h') {
        const delta = startX.current - e.clientX;
        lastWidth = Math.min(MAX_PANEL, Math.max(MIN_PANEL, startWidth.current + delta));
        setPanelWidth(lastWidth);
      } else if (dragging.current === 'v') {
        const panelEl = panelRef.current;
        if (!panelEl) return;
        const rect = panelEl.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        lastSplit = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, relativeY / rect.height));
        setSplitRatio(lastSplit);
      }
    };
    const onUp = () => {
      if (dragging.current === 'h' && lastWidth > 0) {
        try { localStorage.setItem('gcp-panel-width', String(lastWidth)); } catch { /* ignore */ }
      }
      if (dragging.current === 'v' && lastSplit > 0) {
        try { localStorage.setItem('gcp-panel-split', String(lastSplit)); } catch { /* ignore */ }
      }
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Graph canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
        <GraphCanvas />
      </div>

      {/* Drag handle — horizontal */}
      <div
        className="drag-handle"
        onMouseDown={onHDragDown}
        role="separator"
        aria-label="Resize panel width"
        style={{
          width: 4,
          cursor: 'col-resize',
          background: '#30363d',
          flexShrink: 0,
          zIndex: 10,
        }}
      />

      {/* Right panel */}
      <div
        ref={panelRef}
        style={{
          width: panelWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* List — upper portion */}
        <div style={{ flex: `${splitRatio} 0 0`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ListPanel />
        </div>

        {/* Drag handle — vertical */}
        <div
          className="drag-handle"
          onMouseDown={onVDragDown}
          role="separator"
          aria-label="Resize panel height"
          style={{
            height: 4,
            cursor: 'row-resize',
            background: '#30363d',
            flexShrink: 0,
            zIndex: 10,
          }}
        />

        {/* Detail panel — lower portion */}
        <div
          style={{
            flex: `${1 - splitRatio} 0 0`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              background: '#161b22',
              borderBottom: '1px solid #30363d',
              flexShrink: 0,
            }}
          >
            Detail
          </div>
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}
