import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useGCPStore, subscribeToasts, type Toast } from './store/useGCPStore';
import type { AuthState } from './store/useGCPStore';
import { CredentialLoader } from './components/CredentialLoader';
import { Toolbar, ViewSwitcher } from './components/Toolbar';
import { DetailDrawer } from './components/DetailDrawer';
import { OverviewView, GraphView, TableView, ChartsView, FindingsView } from './views';

export default function App() {
  const authState: AuthState = useGCPStore((s) => s.authState);
  const autoAuth = useGCPStore((s) => s.autoAuth);
  const activeView = useGCPStore((s) => s.activeView);

  useEffect(() => { autoAuth(); }, [autoAuth]);

  if (authState === 'checking') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0d1117',
          color: '#8b949e',
          gap: 12,
        }}
      >
        <div className="spinner" />
        <span style={{ fontSize: 13 }}>Connecting...</span>
        <Toaster />
      </div>
    );
  }

  if (authState === 'signed-out') {
    return <CredentialLoader />;
  }

  return (
    <ReactFlowProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: '#0d1117',
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        <ViewSwitcher />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Graph is always mounted (display:none preserves ReactFlow state) */}
          <div style={{ flex: 1, display: activeView === 'graph' ? 'flex' : 'none', overflow: 'hidden' }}>
            <GraphView />
          </div>
          {activeView === 'overview' && <OverviewView />}
          {activeView === 'table' && <TableView />}
          {activeView === 'charts' && <ChartsView />}
          {activeView === 'findings' && <FindingsView />}

          {/* Detail drawer for non-graph views */}
          {activeView !== 'graph' && <DetailDrawer />}
        </div>
      </div>
      <Toaster />
    </ReactFlowProvider>
  );
}

// ── Toast overlay ─────────────────────────────────────────────────────────────

function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            color: '#e6edf3',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.2s ease-out',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
