import { randomBytes } from 'node:crypto';
import { ConnectorError, type DiscoveredInput, type SyncResult } from './types';

/**
 * Conector de AWS: el cliente crea un rol de solo lectura que confía en la cuenta de Ónix
 * con un ExternalId único por organización. Ónix asume ese rol y lista agentes por región.
 */

export const AWS_REGIONS = ['us-east-1', 'us-east-2', 'us-west-2', 'ca-central-1', 'sa-east-1', 'eu-west-1', 'eu-central-1', 'ap-northeast-1', 'ap-southeast-2'];

export function awsConfigured(): boolean {
  return Boolean(process.env.ONIX_AWS_ACCESS_KEY_ID?.trim() && process.env.ONIX_AWS_SECRET_ACCESS_KEY?.trim() && process.env.ONIX_AWS_ACCOUNT_ID?.trim());
}

export function onixAwsAccountId(): string | null {
  return process.env.ONIX_AWS_ACCOUNT_ID?.trim() || null;
}

export function newExternalId(): string {
  return `onix-${randomBytes(12).toString('hex')}`;
}

export const ROLE_ARN = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\/-]{1,512}$/;

/** Política de confianza que el cliente pega al crear el rol. */
export function trustPolicy(externalId: string): string {
  const acct = onixAwsAccountId() ?? '<cuenta-de-onix>';
  return JSON.stringify(
    {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: `arn:aws:iam::${acct}:root` },
          Action: 'sts:AssumeRole',
          Condition: { StringEquals: { 'sts:ExternalId': externalId } },
        },
      ],
    },
    null,
    2,
  );
}

/** Permisos de solo lectura que necesita el rol. */
export const PERMISSIONS_POLICY = JSON.stringify(
  {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['bedrock:ListAgents', 'bedrock:GetAgent', 'bedrock-agentcore:ListAgentRuntimes', 'bedrock-agentcore:GetAgentRuntime'],
        Resource: '*',
      },
    ],
  },
  null,
  2,
);

function riskFromStatus(status?: string): 'Bajo' | 'Medio' | 'Alto' | null {
  if (!status) return null;
  return /FAILED/i.test(status) ? 'Medio' : null;
}

export async function syncAws(cfg: { roleArn: string; externalId: string; regions: string[] }): Promise<SyncResult> {
  if (!awsConfigured()) throw new ConnectorError('El conector de AWS no está configurado en Ónix.', 'Faltan las credenciales de la cuenta de Ónix.');
  const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
  const sts = new STSClient({
    region: 'us-east-1',
    credentials: { accessKeyId: process.env.ONIX_AWS_ACCESS_KEY_ID!.trim(), secretAccessKey: process.env.ONIX_AWS_SECRET_ACCESS_KEY!.trim() },
  });
  let assumed;
  try {
    assumed = await sts.send(new AssumeRoleCommand({ RoleArn: cfg.roleArn, RoleSessionName: 'onix-govern-discovery', ExternalId: cfg.externalId, DurationSeconds: 900 }));
  } catch (e) {
    throw new ConnectorError('No se pudo asumir el rol de AWS.', 'Revisa que el ARN sea correcto y que la política de confianza tenga la cuenta de Ónix y el ExternalId que te mostramos.');
  }
  const c = assumed.Credentials;
  if (!c?.AccessKeyId || !c.SecretAccessKey) throw new ConnectorError('AWS no devolvió credenciales temporales.');
  const credentials = { accessKeyId: c.AccessKeyId, secretAccessKey: c.SecretAccessKey, sessionToken: c.SessionToken };

  const { BedrockAgentClient, ListAgentsCommand } = await import('@aws-sdk/client-bedrock-agent');
  const { BedrockAgentCoreControlClient, ListAgentRuntimesCommand } = await import('@aws-sdk/client-bedrock-agentcore-control');

  const items: DiscoveredInput[] = [];
  const warnings: string[] = [];
  let bedrockOk = true;
  let coreOk = true;
  const account = cfg.roleArn.split(':')[4] ?? '';

  for (const region of cfg.regions) {
    try {
      const client = new BedrockAgentClient({ region, credentials });
      let next: string | undefined;
      for (let page = 0; page < 20; page++) {
        const r = await client.send(new ListAgentsCommand({ maxResults: 100, nextToken: next }));
        for (const a of r.agentSummaries ?? []) {
          if (!a.agentId) continue;
          items.push({
            source: 'bedrock',
            externalId: `${account}:${region}:${a.agentId}`,
            kind: 'agente',
            name: a.agentName ?? a.agentId,
            vendor: 'AWS',
            platform: 'bedrock',
            ownerName: null,
            usersCount: null,
            suggestedRisk: riskFromStatus(a.agentStatus),
            details: { region, account, status: a.agentStatus ?? null, description: a.description ?? null, updatedAt: a.updatedAt?.toISOString() ?? null },
          });
        }
        next = r.nextToken;
        if (!next) break;
      }
    } catch (e) {
      bedrockOk = false;
      warnings.push(`Bedrock en ${region}: ${(e as Error).name === 'AccessDeniedException' ? 'sin permiso bedrock:ListAgents' : 'no respondió'}.`);
    }
    try {
      const client = new BedrockAgentCoreControlClient({ region, credentials });
      let next: string | undefined;
      for (let page = 0; page < 20; page++) {
        const r = await client.send(new ListAgentRuntimesCommand({ maxResults: 100, nextToken: next }));
        for (const a of r.agentRuntimes ?? []) {
          if (!a.agentRuntimeId) continue;
          items.push({
            source: 'agentcore',
            externalId: `${account}:${region}:${a.agentRuntimeId}`,
            kind: 'agente',
            name: a.agentRuntimeName ?? a.agentRuntimeId,
            vendor: 'AWS',
            platform: 'bedrock',
            ownerName: null,
            usersCount: null,
            suggestedRisk: riskFromStatus(a.status),
            details: { region, account, status: a.status ?? null, description: a.description ?? null, updatedAt: a.lastUpdatedAt?.toISOString() ?? null },
          });
        }
        next = r.nextToken;
        if (!next) break;
      }
    } catch (e) {
      coreOk = false;
      warnings.push(`AgentCore en ${region}: ${(e as Error).name === 'AccessDeniedException' ? 'sin permiso bedrock-agentcore:ListAgentRuntimes' : 'no respondió'}.`);
    }
  }
  const okSources: SyncResult['okSources'] = [];
  if (bedrockOk) okSources.push('bedrock');
  if (coreOk) okSources.push('agentcore');
  return { items, okSources, warnings };
}
