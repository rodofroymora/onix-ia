'use server';

import { providerFromEnv } from '@onix/agent';
import {
  AI_TYPES,
  BUSINESS_AREAS,
  DATA_CLASSES,
  DEPLOYMENTS,
  STRATEGIC_OBJECTIVES,
  USER_SCOPES,
  VALUE_TYPES,
  inCatalog,
} from '@onix/templates';
import { appendAudit } from '@/lib/audit';
import { getDb, withOrg } from '@/lib/db';
import { llmHint } from '@/lib/server/narrative';
import { requireWriteAccess } from '@/lib/session';

export interface CaseSuggestion {
  name?: string;
  description: string;
  area?: string;
  aiType?: string;
  valueType?: string;
  strategicObjective?: string;
  dataClassification?: string;
  deployment?: string;
  userScope?: string;
  usesPersonalData?: boolean;
  decidesOnPeople?: boolean;
  customerFacing?: boolean;
  autonomy?: 'sugiere' | 'aprueba_humano' | 'autonomo';
  questions: string[];
}

export interface CaseAssistState {
  ok: boolean;
  source: 'llm' | 'datos';
  suggestion: CaseSuggestion | null;
  error?: string;
  llmError?: string;
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

/** Respaldo sin modelo: reglas de palabras clave sobre lo que escribió la persona. */
function heuristic(raw: string, name: string): CaseSuggestion {
  const t = `${name} ${raw}`.toLowerCase();
  const s: CaseSuggestion = { description: '', questions: [] };
  if (has(t, 'agente', 'ejecuta', 'automátic', 'automatic', 'flujo', 'n8n', 'zapier', 'make')) s.aiType = has(t, 'agente') ? 'agente' : 'automatizacion';
  else if (has(t, 'pronóst', 'pronost', 'predic', 'demanda', 'forecast')) s.aiType = 'predictivo';
  else if (has(t, 'fraude', 'detect', 'anomal', 'clasific', 'filtro', 'filtra')) s.aiType = 'clasificacion';
  else if (has(t, 'imagen', 'foto', 'video', 'cámara', 'camara', 'visión')) s.aiType = 'vision';
  else if (has(t, 'recomend')) s.aiType = 'recomendacion';
  else if (has(t, 'copilot', 'asistente', 'chat', 'bot', 'whatsapp')) s.aiType = 'copiloto';
  else if (has(t, 'redact', 'contenido', 'resum', 'texto', 'correo', 'post')) s.aiType = 'gen_texto';

  s.customerFacing = has(t, 'cliente', 'huésped', 'huesped', 'whatsapp', 'web', 'público', 'publico', 'reseña');
  s.decidesOnPeople = has(t, 'candidat', 'cv', 'contrata', 'crédito', 'credito', 'evalúa a', 'despid', 'empleado');
  s.usesPersonalData = s.decidesOnPeople || has(t, 'cliente', 'huésped', 'huesped', 'paciente', 'reserv', 'pms', 'crm', 'personal', 'nombre', 'teléfono', 'telefono', 'correo', 'expediente', 'nómina', 'nomina');
  s.dataClassification = has(t, 'salud', 'médic', 'medic', 'biométr', 'biometr', 'nómina', 'nomina', 'crédito', 'credito')
    ? 'sensibles'
    : s.usesPersonalData
      ? 'personales'
      : has(t, 'interno', 'manual', 'política', 'politica')
        ? 'interna'
        : undefined;
  s.autonomy = has(t, 'automátic', 'automatic', 'sin revisión', 'solo', 'agente') ? (s.decidesOnPeople ? 'aprueba_humano' : 'autonomo') : 'sugiere';
  s.userScope = s.customerFacing ? 'clientes' : has(t, 'toda la empresa', 'todos los empleados', 'personal') ? 'empresa' : 'area';
  s.valueType = has(t, 'venta', 'ingreso', 'conversi', 'reserva')
    ? 'ingresos'
    : has(t, 'ahorr', 'costo', 'reduc')
      ? 'costos'
      : s.customerFacing
        ? 'experiencia'
        : has(t, 'fraude', 'riesgo', 'cumpl')
          ? 'riesgo'
          : 'productividad';
  s.strategicObjective = STRATEGIC_OBJECTIVES.find((o) =>
    s.valueType === 'ingresos' ? o.k === 'crecer' : s.valueType === 'experiencia' ? o.k === 'cliente' : s.valueType === 'riesgo' ? o.k === 'cumplimiento' : o.k === 'eficiencia',
  )?.n;
  if (has(t, 'copilot', 'chatgpt', 'gemini', 'claude', 'salesforce', 'hubspot', 'zendesk')) s.deployment = 'saas';
  else if (has(t, 'azure', 'aws', 'bedrock', 'vertex', 'google cloud')) s.deployment = 'cloud_propia';
  else if (has(t, 'api', 'openai')) s.deployment = 'api';
  s.area = has(t, 'cliente', 'huésped', 'huesped', 'reserv', 'whatsapp')
    ? 'Atención a clientes'
    : has(t, 'marketing', 'redes', 'contenido', 'campaña')
      ? 'Marketing y contenido'
      : has(t, 'venta')
        ? 'Ventas'
        : has(t, 'candidat', 'cv', 'reclut', 'nómina', 'nomina')
          ? 'Personal y reclutamiento'
          : has(t, 'fraude', 'pago', 'crédito', 'credito', 'factura', 'finanz')
            ? 'Finanzas y crédito'
            : undefined;

  const typeName = AI_TYPES.find((a) => a.k === s.aiType)?.n.toLowerCase();
  if (!name) {
    const words = raw.replace(/[.,;:].*$/, '').split(/\s+/).slice(0, 7).join(' ');
    s.name = words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : undefined;
  }
  const clean = raw.trim().replace(/\s+/g, ' ').replace(/\.$/, '');
  s.description = [
    clean ? `${clean.charAt(0).toUpperCase()}${clean.slice(1)}.` : '',
    typeName ? `Es un caso de ${typeName}` : '',
    s.customerFacing ? 'de cara al cliente' : 'de uso interno',
    s.usesPersonalData ? 'que trata datos personales.' : 'sin datos personales identificados.',
    s.autonomy === 'autonomo' ? 'Actúa sin revisión humana, por lo que conviene definir límites y monitoreo.' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(' de cara', ', de cara')
    .replace(' de uso', ', de uso');
  s.questions = [
    'Quién es el dueño del caso y quién aprueba los cambios',
    s.usesPersonalData ? 'Qué datos personales usa y con qué aviso de privacidad' : 'Si en algún momento entrarán datos personales',
    'Cómo se mide el valor (horas, ventas o errores evitados)',
  ];
  return s;
}

const SYSTEM = [
  'Eres el Asistente Ónix. Ayudas a documentar un caso de uso de IA para el inventario de gobierno de una empresa mediana en México.',
  'Responde SOLO con un objeto JSON válido, sin texto antes ni después.',
  'Escribe en español de México, frases cortas, sin guiones largos. No inventes cifras ni nombres de personas.',
].join(' ');

function schemaText() {
  const list = (o: { k: string; n: string }[]) => o.map((x) => `${x.k} (${x.n})`).join(', ');
  return [
    'Campos del JSON:',
    '"name": nombre corto del caso (máximo 8 palabras);',
    '"description": 2 o 3 frases: qué hace, para quién y con qué datos;',
    `"area": una de [${BUSINESS_AREAS.join(', ')}];`,
    `"aiType": una clave de [${list(AI_TYPES)}];`,
    `"valueType": una clave de [${list(VALUE_TYPES)}];`,
    `"strategicObjective": uno de [${STRATEGIC_OBJECTIVES.map((o) => o.n).join(', ')}];`,
    `"dataClassification": una clave de [${list(DATA_CLASSES)}];`,
    `"deployment": una clave de [${list(DEPLOYMENTS)}];`,
    `"userScope": una clave de [${list(USER_SCOPES)}];`,
    '"usesPersonalData", "decidesOnPeople", "customerFacing": true o false;',
    '"autonomy": "sugiere", "aprueba_humano" o "autonomo";',
    '"questions": hasta 3 preguntas cortas que faltan por aclarar.',
    'Omite un campo si no hay forma de saberlo.',
  ].join('\n');
}

function sanitize(x: Record<string, unknown>): CaseSuggestion {
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
  const auto = ['sugiere', 'aprueba_humano', 'autonomo'].includes(String(x.autonomy)) ? (x.autonomy as CaseSuggestion['autonomy']) : undefined;
  return {
    name: str(x.name, 160),
    description: str(x.description, 1000) ?? '',
    area: BUSINESS_AREAS.includes(String(x.area)) ? String(x.area) : undefined,
    aiType: inCatalog(AI_TYPES, x.aiType) ?? undefined,
    valueType: inCatalog(VALUE_TYPES, x.valueType) ?? undefined,
    strategicObjective: STRATEGIC_OBJECTIVES.some((o) => o.n === x.strategicObjective) ? String(x.strategicObjective) : undefined,
    dataClassification: inCatalog(DATA_CLASSES, x.dataClassification) ?? undefined,
    deployment: inCatalog(DEPLOYMENTS, x.deployment) ?? undefined,
    userScope: inCatalog(USER_SCOPES, x.userScope) ?? undefined,
    usesPersonalData: bool(x.usesPersonalData),
    decidesOnPeople: bool(x.decidesOnPeople),
    customerFacing: bool(x.customerFacing),
    autonomy: auto,
    questions: Array.isArray(x.questions) ? x.questions.filter((q): q is string => typeof q === 'string').slice(0, 3).map((q) => q.slice(0, 200)) : [],
  };
}

/** CU-05 asistido: de una explicación libre a una ficha clasificada con las listas estándar. */
export async function assistCaseAction(_prev: CaseAssistState | null, formData: FormData): Promise<CaseAssistState> {
  const session = await requireWriteAccess();
  const raw = String(formData.get('raw') ?? '').trim().slice(0, 2000);
  const name = String(formData.get('name') ?? '').trim().slice(0, 160);
  if (raw.length < 12) return { ok: false, source: 'datos', suggestion: null, error: 'Cuéntalo en una o dos frases para poder ayudarte.' };

  let suggestion: CaseSuggestion | null = null;
  let source: CaseAssistState['source'] = 'datos';
  let llmError: string | undefined;
  const provider = providerFromEnv();
  if (provider) {
    try {
      const res = await provider.complete({
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${schemaText()}\n\nNombre actual: ${name || '(sin nombre)'}\nLo que cuenta la persona: ${raw}` },
        ],
      });
      const json = res.content.slice(res.content.indexOf('{'), res.content.lastIndexOf('}') + 1);
      suggestion = sanitize(JSON.parse(json) as Record<string, unknown>);
      source = 'llm';
    } catch (err) {
      console.error('[asistente-caso] fallo del proveedor, uso reglas', err);
      llmError = llmHint(err);
    }
  }
  if (!suggestion || !suggestion.description) suggestion = heuristic(raw, name);

  const { db } = getDb();
  await withOrg(db, session.user.organizationId, (tx) =>
    appendAudit(tx, {
      organizationId: session.user.organizationId,
      actorUserId: session.user.id,
      action: 'assistant.case',
      entityType: 'assistant',
      meta: { source },
    }),
  );
  return { ok: true, source, suggestion, llmError };
}
