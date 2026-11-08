import { eq } from 'drizzle-orm';
import { aiAgents, aiUseCases } from '@onix/db';
import { AGENT_PLATFORMS } from '@onix/templates';
import { getDb, withOrg } from '@/lib/db';

const RISK_ORDER: Record<string, number> = { Bajo: 1, Medio: 2, Alto: 3, Inaceptable: 4 };

/** Adivina la plataforma de un caso del inventario por su herramienta o proveedor. */
function platformFromCase(tech: string | null, vendor: string | null): string {
  const t = `${tech ?? ''} ${vendor ?? ''}`.toLowerCase();
  if (t.includes('copilot studio')) return 'copilot_studio';
  if (t.includes('365') || t.includes('copilot')) return 'agent_builder';
  if (t.includes('azure') || t.includes('foundry')) return 'azure_foundry';
  if (t.includes('vertex')) return 'vertex';
  if (t.includes('gemini') || t.includes('google')) return 'gemini_ent';
  if (t.includes('bedrock') || t.includes('aws') || t.includes('amazon')) return 'bedrock';
  if (t.includes('chatgpt') || t.includes('openai') || t.includes('gpt')) return 'openai';
  if (t.includes('claude') || t.includes('anthropic')) return 'claude';
  if (t.includes('salesforce') || t.includes('agentforce')) return 'salesforce';
  if (t.includes('servicenow')) return 'servicenow';
  if (t.includes('n8n')) return 'n8n';
  if (t.includes('make') || t.includes('zapier')) return 'make';
  return 'custom';
}

export async function loadAgents(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const rows = await tx.select().from(aiAgents).where(eq(aiAgents.organizationId, organizationId));
    const cases = await tx
      .select({
        id: aiUseCases.id,
        name: aiUseCases.name,
        risk: aiUseCases.risk,
        status: aiUseCases.status,
        inProduction: aiUseCases.inProduction,
        description: aiUseCases.description,
        ownerName: aiUseCases.ownerName,
        technology: aiUseCases.technology,
        vendor: aiUseCases.vendor,
        customerFacing: aiUseCases.customerFacing,
      })
      .from(aiUseCases)
      .where(eq(aiUseCases.organizationId, organizationId));
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const meta = (platform: string) => ({
      platformName: AGENT_PLATFORMS.find((p) => p.k === platform)?.n ?? platform,
      vendor: AGENT_PLATFORMS.find((p) => p.k === platform)?.d ?? 'Otro',
    });
    const real = rows.map((a) => {
      const c = a.useCaseId ? caseById.get(a.useCaseId) : undefined;
      return {
        ...a,
        dataSources: (Array.isArray(a.dataSources) ? a.dataSources : []) as string[],
        capabilities: (Array.isArray(a.capabilities) ? a.capabilities : []) as string[],
        useCaseName: c?.name ?? null,
        caseRisk: c?.risk ?? null,
        // El agente corre con más riesgo que el que declara su caso del inventario.
        riskMismatch: Boolean(c && (RISK_ORDER[a.risk] ?? 0) > (RISK_ORDER[c.risk] ?? 0)),
        fromInventory: false,
        ...meta(a.platform),
      };
    });
    // Casos en producción sin agente registrado: también se muestran en Discovery.
    const linked = new Set(rows.map((a) => a.useCaseId).filter(Boolean));
    const virtual = cases
      .filter((c) => c.inProduction && !linked.has(c.id))
      .map((c) => {
        const platform = platformFromCase(c.technology, c.vendor);
        return {
          id: `caso:${c.id}`,
          organizationId,
          name: c.name,
          description: c.description,
          platform,
          publisher: 'Organización',
          channel: c.customerFacing ? 'Web' : 'Interno',
          ownerName: c.ownerName,
          status: 'En producción',
          risk: c.risk as string,
          managed: true,
          useCaseId: c.id,
          dataSources: [] as string[],
          capabilities: [] as string[],
          monthlyUsers: 0,
          lastActivity: null,
          origin: 'inventario',
          createdAt: new Date(),
          updatedAt: new Date(),
          useCaseName: c.name,
          caseRisk: c.risk as string,
          riskMismatch: false,
          fromInventory: true,
          ...meta(platform),
        };
      });
    return {
      agents: [...real, ...virtual].sort((x, y) => y.monthlyUsers - x.monthlyUsers),
      cases: cases.map((c) => ({ id: c.id, name: c.name, risk: c.risk, inProduction: c.inProduction })),
    };
  });
}

export type AgentRow = Awaited<ReturnType<typeof loadAgents>>['agents'][number];

/* ------------------------------------------------------------ Búsqueda por contexto */

/** Familias de palabras que significan lo mismo en el negocio. */
const SYNONYMS: string[][] = [
  ['cliente', 'huesped', 'usuario', 'consumidor', 'atencion', 'servicio'],
  ['contrato', 'legal', 'juridico', 'clausula', 'abogado'],
  ['factura', 'pago', 'cobranza', 'finanza', 'contab', 'concilia', 'sat', 'erp'],
  ['reclut', 'cv', 'candidat', 'contrata', 'rh', 'person', 'nomina', 'onboarding'],
  ['venta', 'crm', 'comercial', 'cotiza', 'lead', 'propuesta'],
  ['ticket', 'incidencia', 'soporte', 'mesa', 'ti', 'contraseña'],
  ['resum', 'junta', 'reunion', 'transcrib', 'acta', 'grabacion'],
  ['tradu', 'idioma', 'ingles'],
  ['reseña', 'opinion', 'reputacion', 'review'],
  ['fraude', 'riesgo', 'sospech', 'anomal'],
  ['correo', 'email', 'buzon', 'mail'],
  ['whatsapp', 'chat', 'mensaje', 'conversa', 'bot'],
  ['reserva', 'ocupacion', 'tarifa', 'hotel', 'habitacion', 'pms'],
  ['politica', 'manual', 'procedimiento', 'norma'],
  ['dato', 'excel', 'analisis', 'reporte', 'pronostic', 'predic'],
  ['marketing', 'redes', 'contenido', 'post', 'imagen'],
  ['compra', 'proveedor', 'adquisicion'],
];

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'un', 'una', 'que', 'para', 'por', 'con', 'del', 'al', 'se', 'a', 'su', 'sus', 'es', 'lo', 'como', 'hay', 'algun', 'alguno', 'algo', 'agente', 'agentes', 'quien', 'lea', 'leer', 'haga', 'hace', 'tiene', 'tenemos', 'existe', 'usa', 'usan', 'con', 'sobre']);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ');

/** Raíz simple en español: quita plurales y terminaciones comunes. */
const stem = (w: string) => w.replace(/(aciones|acion|amiento|mente|idades|idad|ores|ora|or|es|s)$/, '').slice(0, 9);

const tokens = (s: string) =>
  norm(s)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);

/** Expande cada término con su familia de sinónimos (peso menor). */
function expand(terms: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of terms) {
    out.set(t, Math.max(out.get(t) ?? 0, 1));
    for (const fam of SYNONYMS) {
      if (t.length >= 3 && fam.some((f) => { const k = stem(norm(f)); return t === k || (t.length >= 4 && k.length >= 4 && (t.startsWith(k) || k.startsWith(t))); })) {
        for (const f of fam) {
          const k = stem(norm(f));
          out.set(k, Math.max(out.get(k) ?? 0, 0.6));
        }
      }
    }
  }
  return out;
}

export interface SearchHit {
  id: string;
  score: number;
  why: string[];
}

/** Ordena agentes por parecido con la pregunta (nombre, descripción, datos, capacidades, caso, plataforma). */
export function searchAgents(query: string, agents: AgentRow[], extraTerms: string[] = []): SearchHit[] {
  const q = expand([...tokens(query), ...extraTerms.flatMap(tokens)]);
  if (!q.size) return [];
  const docs = agents.map((a) => {
    const fields: [string, number, string][] = [
      [a.name, 3, 'nombre'],
      [a.description ?? '', 1.5, 'descripción'],
      [a.capabilities.join(' '), 2, 'capacidades'],
      [a.dataSources.join(' '), 2, 'datos'],
      [a.useCaseName ?? '', 1.5, 'caso de uso'],
      [`${a.platformName} ${a.vendor} ${a.channel}`, 1, 'plataforma'],
      [a.ownerName ?? '', 1, 'dueño'],
    ];
    return { a, fields: fields.map(([text, w, label]) => ({ toks: tokens(text), w, label })) };
  });
  // Frecuencia inversa: términos raros pesan más.
  const df = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set(d.fields.flatMap((f) => f.toks));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = docs.length || 1;
  const idf = (t: string) => Math.log(1 + N / (1 + (df.get(t) ?? 0)));
  const hits = docs.map(({ a, fields }) => {
    let score = 0;
    const why = new Set<string>();
    for (const [term, qw] of q) {
      for (const f of fields) {
        const match = f.toks.some((t) => t === term || (term.length >= 4 && (t.startsWith(term) || term.startsWith(t))));
        if (match) {
          score += qw * f.w * idf(term);
          why.add(f.label);
        }
      }
    }
    return { id: a.id, score, why: [...why] };
  });
  const max = Math.max(...hits.map((h) => h.score), 0);
  return hits
    .filter((h) => h.score > 0 && h.score >= max * 0.3)
    .map((h) => ({ ...h, score: Math.round((h.score / (max || 1)) * 100) }))
    .sort((x, y) => y.score - x.score);
}

export interface AgentAnswer {
  answer: string;
  hits: SearchHit[];
  source: 'llm' | 'reglas';
  llmError?: string;
}

/** Respuesta en lenguaje natural sobre los agentes de la organización (modelo si hay; si no, búsqueda por contexto). */
export async function askAboutAgents(query: string, agents: AgentRow[]): Promise<AgentAnswer> {
  const { providerFromEnv } = await import('@onix/agent');
  const provider = providerFromEnv();
  let llmError: string | undefined;
  if (provider && query.trim().length >= 3 && agents.length) {
    const catalog = agents
      .slice(0, 120)
      .map((a, i) =>
        [
          `#${i + 1}`,
          a.name,
          `plataforma: ${a.platformName} (${a.vendor})`,
          `estado: ${a.status}`,
          `riesgo: ${a.risk}`,
          `dueño: ${a.ownerName ?? 'sin dueño'}`,
          a.managed ? 'gestionado' : 'no gestionado',
          `caso: ${a.useCaseName ?? 'sin caso en el inventario'}`,
          a.description ? `qué hace: ${a.description}` : '',
          a.dataSources.length ? `datos: ${a.dataSources.join(', ')}` : '',
          a.capabilities.length ? `puede: ${a.capabilities.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');
    try {
      const res = await provider.complete({
        maxTokens: 700,
        messages: [
          {
            role: 'system',
            content: [
              'Eres el Asistente Ónix. Respondes preguntas sobre los agentes de IA registrados en una empresa mediana en México.',
              'Usa SOLO el catálogo que te doy. Si nada aplica, dilo. No inventes agentes ni datos.',
              'Responde SOLO con JSON válido: {"answer": "2 o 3 frases en español de México, tratando de tú, sin guiones largos", "matches": [{"n": número del catálogo, "why": "razón corta"}]}.',
              'En matches pon solo los agentes relevantes, del más al menos relevante, máximo 10.',
            ].join(' '),
          },
          { role: 'user', content: `Catálogo:\n${catalog}\n\nPregunta: ${query.slice(0, 300)}` },
        ],
      });
      const json = res.content.slice(res.content.indexOf('{'), res.content.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as { answer?: unknown; matches?: { n?: unknown; why?: unknown }[] };
      const list = agents.slice(0, 120);
      const seen = new Set<string>();
      const hits: SearchHit[] = [];
      for (const [i, m] of (Array.isArray(parsed.matches) ? parsed.matches : []).entries()) {
        const a = list[Number(m.n) - 1];
        if (!a || seen.has(a.id)) continue;
        seen.add(a.id);
        hits.push({ id: a.id, score: Math.max(20, 100 - i * 9), why: [typeof m.why === 'string' ? m.why.slice(0, 160) : 'relacionado'] });
      }
      const answer = typeof parsed.answer === 'string' ? parsed.answer.slice(0, 600) : '';
      if (answer) return { answer, hits, source: 'llm' };
    } catch (err) {
      console.error('[discovery] fallo del modelo, uso búsqueda por contexto', err);
      llmError = (err as { hint?: string })?.hint ?? 'El modelo no respondió.';
    }
  }
  const hits = searchAgents(query, agents);
  const top = hits.slice(0, 3).map((h) => agents.find((a) => a.id === h.id)!.name);
  const answer = hits.length
    ? `Encontré ${hits.length} ${hits.length === 1 ? 'agente relacionado' : 'agentes relacionados'}${top.length ? `; los más cercanos son ${top.join(', ')}` : ''}.`
    : 'No encontré agentes relacionados con esa búsqueda.';
  return { answer, hits, source: 'reglas', llmError };
}
