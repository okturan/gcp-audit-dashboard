import { create } from 'zustand';
import type { AppNode, AppEdge, InsightsMap, BillingAccount, ProjectDiscovery } from '../types';
import { discoverAll } from '../discovery';
import { buildGraph } from '../graph/builder';
import { analyzeWithClaude } from '../claude/enricher';
import { requestToken, clearToken, getToken, setToken } from '../auth/GoogleOAuth';

// ── Toast notifications ──────────────────────────────────────────────────────
let _toastId = 0;
export interface Toast { id: number; message: string; }
const _toastListeners = new Set<(toasts: Toast[]) => void>();
let _toasts: Toast[] = [];

function notifyToastListeners() {
  for (const fn of _toastListeners) fn(_toasts);
}

export function addToast(message: string, durationMs = 2000) {
  const id = ++_toastId;
  _toasts = [..._toasts, { id, message }];
  notifyToastListeners();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notifyToastListeners();
  }, durationMs);
}

export function subscribeToasts(fn: (toasts: Toast[]) => void) {
  _toastListeners.add(fn);
  return () => { _toastListeners.delete(fn); };
}

type DiscoveryState = 'idle' | 'loading' | 'success' | 'error';
type InsightState = 'idle' | 'loading' | 'success' | 'error';
export type AuthState = 'checking' | 'signed-out' | 'signed-in';
export type AuthMethod = 'gcloud' | 'oauth' | null;
export type ViewId = 'overview' | 'graph' | 'table' | 'charts' | 'findings';

// Module-level flag — prevents autoAuth from re-firing after manual sign-out.
// Cleared on page refresh (module re-initializes).
let _manuallySignedOut = false;

interface GCPStore {
  // Auth
  oauthClientId: string;
  authState: AuthState;
  authMethod: AuthMethod;
  gcloudEmail: string;
  signInError: string | null;

  // Claude
  claudeApiKey: string;

  // Discovery
  discoveryState: DiscoveryState;
  discoveryError: string | null;
  discoveryProgress: string;
  discoveryTotal: number;
  discoveryDone: number;
  discoveryWarnings: number;
  rawBillingAccounts: BillingAccount[];
  rawProjects: ProjectDiscovery[];

  // Graph
  nodes: AppNode[];
  edges: AppEdge[];

  // Insights
  insights: InsightsMap;
  insightState: InsightState;

  // UI
  activeView: ViewId;
  selectedNodeId: string | null;
  panToId: string | null;
  fitViewTrigger: number;
  lastDiscoveredAt: Date | null;
  searchQuery: string;
  hiddenNodeTypes: Set<string>; // node types to hide from graph
  detailDrawerNodeId: string | null;

  // Actions
  setOAuthClientId: (id: string) => void;
  autoAuth: () => Promise<void>;
  signIn: () => void;
  signOut: () => void;
  bumpFitView: () => void;
  setClaudeApiKey: (key: string) => void;
  discover: () => Promise<void>;
  analyze: () => Promise<void>;
  setActiveView: (view: ViewId) => void;
  setSelectedNodeId: (id: string | null) => void;
  panToNode: (id: string) => void;
  openDetailDrawer: (nodeId: string) => void;
  closeDetailDrawer: () => void;
  setSearchQuery: (q: string) => void;
  toggleNodeType: (type: string) => void;
}

let _refreshTimer: ReturnType<typeof setTimeout> | null = null;
let _discoveryAbort: AbortController | null = null;

function scheduleTokenRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  // Refresh 5 minutes before the 1-hour expiry
  _refreshTimer = setTimeout(async () => {
    try {
      const resp = await fetch('/api/gcloud-token');
      if (resp.ok) {
        const data = await resp.json() as { token?: string };
        if (data.token) {
          setToken(data.token, 3600);
          scheduleTokenRefresh();
        }
      }
    } catch { /* gcloud not available — token will expire naturally */ }
  }, 55 * 60 * 1000); // 55 minutes
}

export const useGCPStore = create<GCPStore>((set, get) => ({
  oauthClientId: '',
  authState: 'checking',
  authMethod: null,
  gcloudEmail: '',
  signInError: null,

  claudeApiKey: '',

  discoveryState: 'idle',
  discoveryError: null,
  discoveryProgress: '',
  discoveryTotal: 0,
  discoveryDone: 0,
  discoveryWarnings: 0,
  rawBillingAccounts: [],
  rawProjects: [],

  nodes: [],
  edges: [],

  insights: {},
  insightState: 'idle',

  activeView: 'overview',
  selectedNodeId: null,
  panToId: null,
  fitViewTrigger: 0,
  lastDiscoveredAt: null,
  searchQuery: '',
  hiddenNodeTypes: new Set<string>(),
  detailDrawerNodeId: null,

  setOAuthClientId: (id) => {
    try { localStorage.setItem('gcp-oauth-client-id', id); } catch { /* ignore */ }
    set({ oauthClientId: id, signInError: null });
  },

  // Try gcloud CLI auth first — works automatically when running via npm run dev.
  // Falls back to Google OAuth popup if gcloud isn't available.
  autoAuth: async () => {
    if (_manuallySignedOut) {
      set({ authState: 'signed-out' });
      return;
    }
    set({ authState: 'checking', signInError: null });
    try {
      const resp = await fetch('/api/gcloud-token');
      if (resp.ok) {
        const data = await resp.json() as { token?: string; email?: string; error?: string };
        if (data.token) {
          setToken(data.token, 3600);
          scheduleTokenRefresh();
          set({ authState: 'signed-in', authMethod: 'gcloud', gcloudEmail: data.email ?? '' });
          addToast('Signed in via gcloud CLI');
          // Auto-discover after successful gcloud auth
          setTimeout(() => get().discover(), 100);
          return;
        }
      }
    } catch { /* gcloud not available */ }
    // gcloud path failed — stay on sign-in screen for manual OAuth
    set({ authState: 'signed-out' });
  },

  signIn: () => {
    const { oauthClientId } = get();
    if (!oauthClientId) {
      set({ signInError: 'Enter your OAuth Client ID first' });
      return;
    }
    set({ signInError: null });
    requestToken(
      oauthClientId,
      () => set({ authState: 'signed-in', authMethod: 'oauth', signInError: null, gcloudEmail: '' }),
      (err) => set({ signInError: err, authState: 'signed-out' }),
    );
  },

  signOut: () => {
    _manuallySignedOut = true;
    clearToken();
    if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
    set({
      authState: 'signed-out',
      authMethod: null,
      gcloudEmail: '',
      nodes: [],
      edges: [],
      rawBillingAccounts: [],
      rawProjects: [],
      insights: {},
      discoveryState: 'idle',
      insightState: 'idle',
      activeView: 'overview',
      detailDrawerNodeId: null,
      selectedNodeId: null,
    });
    addToast('Signed out');
  },

  setClaudeApiKey: (key) => {
    // Not persisted — API keys are secrets and should not be stored in localStorage
    set({ claudeApiKey: key });
  },

  discover: async () => {
    if (!getToken()) {
      set({ discoveryState: 'error', discoveryError: 'Not signed in' });
      return;
    }

    // Abort any in-flight discovery before starting a new one
    _discoveryAbort?.abort();
    _discoveryAbort = new AbortController();
    const { signal } = _discoveryAbort;

    set({ discoveryState: 'loading', discoveryError: null, discoveryProgress: 'Starting discovery…', discoveryTotal: 0, discoveryDone: 0, discoveryWarnings: 0 });
    try {
      const result = await discoverAll((msg, done, total) => set({
        discoveryProgress: msg,
        ...(done !== undefined ? { discoveryDone: done } : {}),
        ...(total !== undefined ? { discoveryTotal: total } : {}),
      }), signal);
      const { insights } = get();
      const { nodes, edges } = buildGraph(result.billingAccounts, result.projects, insights);
      const now = new Date();
      set((s) => ({
        discoveryState: 'success',
        rawBillingAccounts: result.billingAccounts,
        rawProjects: result.projects,
        nodes,
        edges,
        discoveryProgress: '',
        discoveryWarnings: result.partialFailures,
        fitViewTrigger: s.fitViewTrigger + 1,
        lastDiscoveredAt: now,
      }));
      // Cache discovery in sessionStorage for page-refresh resilience
      try {
        sessionStorage.setItem('gcp-discovery-cache', JSON.stringify({
          billingAccounts: result.billingAccounts,
          projects: result.projects,
          ts: now.getTime(),
        }));
      } catch { /* quota exceeded or private browsing */ }
      _discoveryAbort = null;
    } catch (err) {
      // Silently ignore aborted requests — a new discovery is already in progress
      if (err instanceof DOMException && err.name === 'AbortError') return;
      set({ discoveryState: 'error', discoveryError: err instanceof Error ? err.message : String(err), discoveryProgress: '' });
      _discoveryAbort = null;
    }
  },

  analyze: async () => {
    const { claudeApiKey, rawBillingAccounts, rawProjects } = get();
    if (!claudeApiKey || rawProjects.length === 0) return;
    set({ insightState: 'loading' });
    try {
      const insights = await analyzeWithClaude(claudeApiKey, rawBillingAccounts, rawProjects);
      const { nodes, edges } = buildGraph(rawBillingAccounts, rawProjects, insights);
      set({ insights, insightState: 'success', nodes, edges });
    } catch (err) {
      console.error('Claude analysis failed:', err);
      set({ insightState: 'error' });
    }
  },

  setActiveView: (view) => {
    const prev = get().activeView;
    if (view === 'graph' && prev !== 'graph') {
      // Bump fitView when switching back to graph so it recalculates layout
      set((s) => ({ activeView: view, fitViewTrigger: s.fitViewTrigger + 1 }));
    } else {
      set({ activeView: view });
    }
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  panToNode: (id) => {
    const { activeView } = get();
    if (activeView === 'graph') {
      set({ selectedNodeId: id, panToId: id });
    } else {
      // In non-graph views, open the detail drawer
      set({ selectedNodeId: id, detailDrawerNodeId: id });
    }
  },

  openDetailDrawer: (nodeId) => set({ selectedNodeId: nodeId, detailDrawerNodeId: nodeId }),
  closeDetailDrawer: () => set({ detailDrawerNodeId: null }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleNodeType: (type) => set((s) => {
    const next = new Set(s.hiddenNodeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    return { hiddenNodeTypes: next };
  }),

  bumpFitView: () => set((s) => ({ fitViewTrigger: s.fitViewTrigger + 1 })),
}));

// Rehydrate persisted values (client ID is public, fine to store)
// Claude API key is intentionally NOT persisted — it's a secret
try {
  const clientId = localStorage.getItem('gcp-oauth-client-id');
  // Clean up any previously stored key
  localStorage.removeItem('gcp-claude-key');
  if (clientId) useGCPStore.getState().setOAuthClientId(clientId);
} catch { /* ignore */ }

// Rehydrate discovery from sessionStorage (survives page refresh)
try {
  const cached = sessionStorage.getItem('gcp-discovery-cache');
  if (cached) {
    const parsed = JSON.parse(cached);
    // Validate shape before using — corrupted or tampered data should not crash the app
    if (
      parsed == null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      !Array.isArray(parsed.billingAccounts) ||
      !Array.isArray(parsed.projects) ||
      typeof parsed.ts !== 'number'
    ) {
      sessionStorage.removeItem('gcp-discovery-cache');
    } else {
      const { billingAccounts, projects, ts } = parsed as {
        billingAccounts: BillingAccount[];
        projects: ProjectDiscovery[];
        ts: number;
      };
      // Only restore if less than 30 minutes old
      if (Date.now() - ts < 30 * 60 * 1000 && projects.length > 0) {
        const { nodes, edges } = buildGraph(billingAccounts, projects, {});
        useGCPStore.setState({
          rawBillingAccounts: billingAccounts,
          rawProjects: projects,
          nodes,
          edges,
          discoveryState: 'success',
          lastDiscoveredAt: new Date(ts),
        });
      }
    }
  }
} catch {
  // JSON.parse failed or other error — remove corrupted cache
  try { sessionStorage.removeItem('gcp-discovery-cache'); } catch { /* ignore */ }
}
