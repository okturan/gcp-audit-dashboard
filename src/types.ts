// ─── Service Account ──────────────────────────────────────────────────────────
export interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

// ─── GCP Resources ────────────────────────────────────────────────────────────
export interface BillingAccount {
  name: string; // "billingAccounts/XXXXXX-XXXXXX-XXXXXX"
  open: boolean;
  displayName: string;
  masterBillingAccount?: string;
  currencyCode: string;
}

export interface GCPProject {
  name: string;
  parent: string;
  projectId: string;
  state: string; // ACTIVE | DELETE_REQUESTED
  displayName: string;
  createTime: string;
  updateTime: string;
  etag: string;
  labels?: Record<string, string>;
}

export interface ProjectBillingInfo {
  name: string;
  projectId: string;
  billingAccountName: string; // "billingAccounts/XXXXXX-..."
  billingEnabled: boolean;
}

export interface APIKeyRestrictions {
  apiTargets?: Array<{ service: string; methods?: string[] }>;
  browserKeyRestrictions?: { allowedReferrers: string[] };
  serverKeyRestrictions?: { allowedIps: string[] };
}

export interface APIKey {
  name: string; // projects/{proj}/locations/global/keys/{key}
  uid: string;
  displayName: string;
  createTime: string;
  updateTime: string;
  restrictions?: APIKeyRestrictions;
  etag: string;
  projectId?: string; // computed
}

export interface GCPService {
  name: string; // projects/{n}/services/{api}
  config: {
    name: string; // e.g. "compute.googleapis.com"
    title?: string;
    documentation?: { summary?: string };
  };
  state: 'STATE_UNSPECIFIED' | 'DISABLED' | 'ENABLED';
  projectId?: string; // computed
}

export interface TimeSeriesPoint {
  date: string;   // YYYY-MM-DD
  value: number;
}

export interface UsageData {
  projectId: string;
  tokenCount?: number;
  requestCount?: number;
  requestBreakdown?: Record<string, number>;
  tokenBreakdown?: Record<string, number>;
  responseCodeBreakdown?: Record<string, number>;  // "2xx" | "4xx" | "5xx" → count
  requestTimeSeries?: TimeSeriesPoint[];
  tokenTimeSeries?: TimeSeriesPoint[];
}

// ─── IAM ──────────────────────────────────────────────────────────────────────
export interface IAMBinding {
  role: string;
  members: string[];
}

export interface ProjectServiceAccount {
  name: string;
  email: string;
  displayName: string;
  description?: string;
  disabled: boolean;
  projectId: string;
}

// ─── Discovery Result ─────────────────────────────────────────────────────────
export interface ProjectDiscovery {
  project: GCPProject;
  billingInfo: ProjectBillingInfo | null;
  apiKeys: APIKey[];
  services: GCPService[];
  usage?: UsageData;
  iamBindings?: IAMBinding[];
  serviceAccounts?: ProjectServiceAccount[];
}

// ─── Claude Insights ──────────────────────────────────────────────────────────
export interface ClaudeInsight {
  severity: 'green' | 'yellow' | 'red' | 'none';
  summary: string;
  suggestions: string[];
}

export type InsightsMap = Record<string, ClaudeInsight>; // nodeId → insight

// ─── React Flow Node Data ─────────────────────────────────────────────────────
export interface BillingAccountNodeData extends Record<string, unknown> {
  billingAccount: BillingAccount;
  projectCount?: number;
  insight?: ClaudeInsight;
}

export interface ProjectNodeData extends Record<string, unknown> {
  project: GCPProject;
  billingInfo?: ProjectBillingInfo | null;
  apiKeyCount: number;
  serviceCount: number;
  services?: GCPService[];
  usage?: UsageData;
  iamBindings?: IAMBinding[];
  serviceAccounts?: ProjectServiceAccount[];
  insight?: ClaudeInsight;
}

export interface APIKeyNodeData extends Record<string, unknown> {
  apiKey: APIKey;
  projectId: string;
  insight?: ClaudeInsight;
}

export interface ServiceNodeData extends Record<string, unknown> {
  service: GCPService;
  projectId: string;
  insight?: ClaudeInsight;
}

// ─── React Flow Node Types ────────────────────────────────────────────────────
import type { Node, Edge } from '@xyflow/react';

export type BillingAccountNodeType = Node<BillingAccountNodeData, 'billingAccount'>;
export type ProjectNodeType = Node<ProjectNodeData, 'project'>;
export type APIKeyNodeType = Node<APIKeyNodeData, 'apiKey'>;
export type ServiceNodeType = Node<ServiceNodeData, 'service'>;

export type AppNode =
  | BillingAccountNodeType
  | ProjectNodeType
  | APIKeyNodeType
  | ServiceNodeType;

export type AppEdge = Edge;
