import type { BillingAccount, ProjectDiscovery } from '../types';

/**
 * Deliberately fictional data for the public demo. Identifiers use reserved
 * example values and contain no credentials, tokens, or customer information.
 */
export const syntheticBillingAccounts: BillingAccount[] = [
  {
    name: 'billingAccounts/SYNTHETIC-OPEN-001',
    open: true,
    displayName: 'Example production billing',
    currencyCode: 'USD',
  },
  {
    name: 'billingAccounts/SYNTHETIC-CLOSED-002',
    open: false,
    displayName: 'Example legacy billing',
    currencyCode: 'USD',
  },
];

export const syntheticProjects: ProjectDiscovery[] = [
  {
    project: {
      name: 'projects/100000000001',
      parent: 'organizations/100000000000',
      projectId: 'retail-production-demo',
      state: 'ACTIVE',
      displayName: 'Retail production (synthetic)',
      createTime: '2024-01-15T09:00:00Z',
      updateTime: '2026-06-20T10:30:00Z',
      etag: 'synthetic-etag-1',
      labels: { environment: 'production', owner: 'platform-demo' },
    },
    billingInfo: {
      name: 'projects/retail-production-demo/billingInfo',
      projectId: 'retail-production-demo',
      billingAccountName: 'billingAccounts/SYNTHETIC-OPEN-001',
      billingEnabled: true,
    },
    apiKeys: [
      {
        name: 'projects/retail-production-demo/locations/global/keys/example-unrestricted',
        uid: 'example-unrestricted',
        displayName: 'Legacy storefront key (synthetic)',
        createTime: '2025-01-10T08:00:00Z',
        updateTime: '2025-01-10T08:00:00Z',
        etag: 'synthetic-key-etag-1',
      },
      {
        name: 'projects/retail-production-demo/locations/global/keys/example-restricted',
        uid: 'example-restricted',
        displayName: 'Maps browser key (synthetic)',
        createTime: '2026-06-15T08:00:00Z',
        updateTime: '2026-06-15T08:00:00Z',
        restrictions: {
          browserKeyRestrictions: { allowedReferrers: ['https://demo.example/*'] },
          apiTargets: [{ service: 'maps-backend.googleapis.com' }],
        },
        etag: 'synthetic-key-etag-2',
      },
    ],
    services: [
      'compute.googleapis.com',
      'storage.googleapis.com',
      'run.googleapis.com',
      'cloudbuild.googleapis.com',
      'secretmanager.googleapis.com',
      'monitoring.googleapis.com',
      'logging.googleapis.com',
      'maps-backend.googleapis.com',
    ].map((name) => ({
      name: `projects/retail-production-demo/services/${name}`,
      config: { name, title: name.split('.')[0] },
      state: 'ENABLED' as const,
      projectId: 'retail-production-demo',
    })),
    usage: {
      projectId: 'retail-production-demo',
      requestCount: 184250,
      tokenCount: 0,
      requestBreakdown: { 'run.googleapis.com': 118400, 'storage.googleapis.com': 65850 },
      responseCodeBreakdown: { '2xx': 181920, '4xx': 2210, '5xx': 120 },
    },
    iamBindings: [
      {
        role: 'roles/viewer',
        members: ['allAuthenticatedUsers', 'deleted:user:former.user@example.invalid?uid=1001'],
      },
      {
        role: 'roles/owner',
        members: ['serviceAccount:deploy-demo@retail-production-demo.example.invalid'],
      },
    ],
    serviceAccounts: [
      {
        name: 'projects/retail-production-demo/serviceAccounts/deploy-demo',
        email: 'deploy-demo@retail-production-demo.example.invalid',
        displayName: 'Synthetic deployment account',
        description: 'Fictional account used only by the public sample dataset.',
        disabled: false,
        projectId: 'retail-production-demo',
      },
    ],
  },
  {
    project: {
      name: 'projects/100000000002',
      parent: 'organizations/100000000000',
      projectId: 'analytics-sandbox-demo',
      state: 'ACTIVE',
      displayName: 'Analytics sandbox (synthetic)',
      createTime: '2025-04-02T12:00:00Z',
      updateTime: '2026-07-01T16:00:00Z',
      etag: 'synthetic-etag-2',
      labels: { environment: 'sandbox', owner: 'data-demo' },
    },
    billingInfo: null,
    apiKeys: [
      {
        name: 'projects/analytics-sandbox-demo/locations/global/keys/example-server',
        uid: 'example-server',
        displayName: 'Ingestion key (synthetic)',
        createTime: '2026-03-01T08:00:00Z',
        updateTime: '2026-03-01T08:00:00Z',
        restrictions: { serverKeyRestrictions: { allowedIps: ['192.0.2.10'] } },
        etag: 'synthetic-key-etag-3',
      },
    ],
    services: [
      'bigquery.googleapis.com',
      'storage.googleapis.com',
      'pubsub.googleapis.com',
      'dataflow.googleapis.com',
      'monitoring.googleapis.com',
      'logging.googleapis.com',
    ].map((name) => ({
      name: `projects/analytics-sandbox-demo/services/${name}`,
      config: { name, title: name.split('.')[0] },
      state: 'ENABLED' as const,
      projectId: 'analytics-sandbox-demo',
    })),
    usage: {
      projectId: 'analytics-sandbox-demo',
      requestCount: 42180,
      tokenCount: 0,
      requestBreakdown: { 'bigquery.googleapis.com': 31000, 'storage.googleapis.com': 11180 },
      responseCodeBreakdown: { '2xx': 41760, '4xx': 410, '5xx': 10 },
    },
    iamBindings: [
      {
        role: 'roles/storage.objectViewer',
        members: ['serviceAccount:retired-demo@analytics-sandbox-demo.example.invalid'],
      },
    ],
    serviceAccounts: [
      {
        name: 'projects/analytics-sandbox-demo/serviceAccounts/retired-demo',
        email: 'retired-demo@analytics-sandbox-demo.example.invalid',
        displayName: 'Synthetic retired pipeline',
        description: 'Disabled fictional account retained in IAM to demonstrate a finding.',
        disabled: true,
        projectId: 'analytics-sandbox-demo',
      },
    ],
  },
  {
    project: {
      name: 'projects/100000000003',
      parent: 'organizations/100000000000',
      projectId: 'legacy-reporting-demo',
      state: 'ACTIVE',
      displayName: 'Legacy reporting (synthetic)',
      createTime: '2023-08-10T12:00:00Z',
      updateTime: '2025-11-12T14:00:00Z',
      etag: 'synthetic-etag-3',
      labels: { environment: 'legacy', owner: 'finance-demo' },
    },
    billingInfo: {
      name: 'projects/legacy-reporting-demo/billingInfo',
      projectId: 'legacy-reporting-demo',
      billingAccountName: 'billingAccounts/SYNTHETIC-CLOSED-002',
      billingEnabled: true,
    },
    apiKeys: [],
    services: [
      {
        name: 'projects/legacy-reporting-demo/services/bigquery.googleapis.com',
        config: { name: 'bigquery.googleapis.com', title: 'BigQuery API' },
        state: 'ENABLED',
        projectId: 'legacy-reporting-demo',
      },
    ],
    usage: { projectId: 'legacy-reporting-demo', requestCount: 320, tokenCount: 0 },
    iamBindings: [],
    serviceAccounts: [],
  },
];
