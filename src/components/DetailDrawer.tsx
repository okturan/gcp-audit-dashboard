import { useEffect } from 'react';
import { useGCPStore } from '../store/useGCPStore';
import { DetailPanel } from './DetailPanel';

export function DetailDrawer() {
  const detailDrawerNodeId = useGCPStore((s) => s.detailDrawerNodeId);
  const closeDetailDrawer = useGCPStore((s) => s.closeDetailDrawer);

  // Close on Escape
  useEffect(() => {
    if (!detailDrawerNodeId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDetailDrawer();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [detailDrawerNodeId, closeDetailDrawer]);

  if (!detailDrawerNodeId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDetailDrawer}
        role="button"
        aria-label="Close detail drawer"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 50,
        }}
      />
      {/* Drawer */}
      <div
        className="detail-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: '90vw',
          background: '#0d1117',
          borderLeft: '1px solid #30363d',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s ease-out',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #30363d',
            background: '#161b22',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            Detail
          </span>
          <button
            onClick={closeDetailDrawer}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '2px 4px',
            }}
            title="Close (Esc)"
            aria-label="Close detail drawer"
          >
            ×
          </button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DetailPanel />
        </div>
      </div>
    </>
  );
}
