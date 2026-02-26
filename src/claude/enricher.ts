import Anthropic from '@anthropic-ai/sdk';
import type { BillingAccount, ProjectDiscovery, InsightsMap, ClaudeInsight } from '../types';
import { billingNodeId, projectNodeId, apiKeyNodeId } from '../graph/builder';

const ERROR_LOG_MAX_CHARS = 500;

interface ClaudeResponse {
  [nodeId: string]: {
    severity: 'green' | 'yellow' | 'red' | 'none';
    summary: string;
    suggestions: string[];
  };
}

export async function analyzeWithClaude(
  apiKey: string,
  billingAccounts: BillingAccount[],
  projects: ProjectDiscovery[]
): Promise<InsightsMap> {
  // This app runs entirely client-side with no backend. The user's Claude API key
  // is kept in memory only (never persisted to storage) and sent directly to
  // Anthropic's API. dangerouslyAllowBrowser is required for this architecture.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // Build a compact summary for Claude
  const payload = {
    billingAccounts: billingAccounts.map((ba) => ({
      id: billingNodeId(ba),
      name: ba.displayName,
      open: ba.open,
      currency: ba.currencyCode,
    })),
    projects: projects.map(({ project, billingInfo, apiKeys, services, usage, iamBindings, serviceAccounts }) => ({
      id: projectNodeId(project.projectId),
      projectId: project.projectId,
      name: project.displayName,
      billingEnabled: billingInfo?.billingEnabled ?? false,
      billingAccount: billingInfo?.billingAccountName ?? null,
      apiKeys: apiKeys.map((k) => ({
        id: apiKeyNodeId(k.uid),
        name: k.displayName,
        restrictions: k.restrictions?.apiTargets?.map((t) => t.service) ?? [],
        created: k.createTime,
      })),
      enabledServices: services.map((s) => s.config?.name).filter(Boolean),
      usage: usage ?? null,
      serviceAccounts: (serviceAccounts ?? []).map(sa => ({
        email: sa.email,
        disabled: sa.disabled,
      })),
      iamBindings: (iamBindings ?? []).map(b => ({
        role: b.role,
        memberCount: b.members.length,
        hasExternalUsers: b.members.some(m => m.startsWith('user:')),
        hasAllUsers: b.members.some(m => m === 'allUsers' || m === 'allAuthenticatedUsers'),
      })),
    })),
  };

  const prompt = `You are a senior GCP security and cost analyst. Analyze this GCP account and return actionable insights per resource.

GCP Account Data:
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON (no markdown, no explanation) mapping nodeId → insight:
{
  "<nodeId>": {
    "severity": "green" | "yellow" | "red" | "none",
    "summary": "one sentence, max 15 words",
    "suggestions": ["specific actionable suggestion", ...]
  }
}

Security rules (red):
- API keys with no restrictions at all → red, suggest adding API target restrictions
- Projects with allUsers/allAuthenticatedUsers IAM bindings → red
- Projects with disabled service accounts still having IAM roles → red
- Billing accounts that are closed but still have projects attached → red

Warning rules (yellow):
- API keys older than 180 days → yellow, suggest rotation
- Projects with billing disabled but active services → yellow
- Projects with 0 API keys and 0 service accounts (may be unused) → yellow
- Projects with >5 IAM bindings per member (overprivileged) → yellow
- Service accounts making up >50% of IAM members → yellow (over-automation)

Healthy rules (green):
- API keys with proper API target restrictions → green
- Projects with billing enabled and reasonable service count (<15) → green
- Billing accounts that are open and have active projects → green

Provide 2-3 specific, actionable suggestions per resource. Be concise.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  let raw: ClaudeResponse;
  try {
    raw = JSON.parse(jsonMatch[0]) as ClaudeResponse;
  } catch {
    console.error('Claude returned malformed JSON:', text.slice(0, ERROR_LOG_MAX_CHARS));
    return {};
  }

  const insights: InsightsMap = {};
  for (const [nodeId, data] of Object.entries(raw)) {
    insights[nodeId] = data as ClaudeInsight;
  }
  return insights;
}
