import { eq } from 'drizzle-orm';
import { aiAgents, aiUseCases } from '@onix/db';
import { AGENT_PLATFORMS } from '@onix/templates';
import { getDb, withOrg } from '@/lib/db';

export async function loadAgents(organizationId: string) {
  const { db } = getDb();
  return withOrg(db, organizationId, async (tx) => {
    const rows = await tx.select().from(aiAgents).where(eq(aiAgents.organizationId, organizationId));
    const cases = await tx
      .select({ id: aiUseCases.id, name: aiUseCases.name })
      .from(aiUseCases)
      .where(eq(aiUseCases.organizationId, organizationId));
    const caseName = new Map(cases.map((c) => [c.id, c.name]));
    return {
      agents: rows
        .map((a) => ({
          ...a,
          dataSources: (Array.isArray(a.dataSources) ? a.dataSources : []) as string[],
          capabilities: (Array.isArray(a.capabilities) ? a.capabilities : []) as string[],
          useCaseName: a.useCaseId ? caseName.get(a.useCaseId) ?? null : null,
          platformName: AGENT_PLATFORMS.find((p) => p.k === a.platform)?.n ?? a.platform,
          vendor: AGENT_PLATFORMS.find((p) => p.k === a.platform)?.d ?? 'Otro',
        }))
        .sort((x, y) => y.monthlyUsers - x.monthlyUsers),
      cases,
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

/** Con modelo configurado, amplía la búsqueda con términos relacionados (si no, regresa vacío). */
export async function expandQueryWithModel(query: string): Promise<string[]> {
  const { providerFromEnv } = await import('@onix/agent');
  const provider = providerFromEnv();
  if (!provider || query.trim().length < 3) return [];
  try {
    const res = await provider.complete({
      messages: [
        {
          role: 'system',
          content:
            'Devuelve SOLO un arreglo JSON de hasta 8 palabras en español relacionadas con la búsqueda, para encontrar agentes de IA en una empresa (sinónimos, áreas, sistemas, datos). Sin texto adicional.',
        },
        { role: 'user', content: query.slice(0, 300) },
      ],
    });
    const json = res.content.slice(res.content.indexOf('['), res.content.lastIndexOf(']') + 1);
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}
