/**
 * Datos demo adicionales de Grupo Altamar: clasificación estándar de casos, agentes,
 * telemetría de uso (6 meses) y dependencias entre acciones del plan. Datos ficticios.
 */
import type { GovernTx } from './client.js';
import * as schema from './schema/index.js';

type CaseClass = Pick<
  typeof schema.aiUseCases.$inferInsert,
  'aiType' | 'valueType' | 'dataClassification' | 'deployment' | 'userScope'
>;

export const CASE_CLASSIFICATION: Record<string, CaseClass> = {
  'Asistente de reservaciones por WhatsApp': { aiType: 'copiloto', valueType: 'ingresos', dataClassification: 'personales', deployment: 'cloud_propia', userScope: 'clientes' },
  'Respuesta a reseñas en línea': { aiType: 'gen_texto', valueType: 'experiencia', dataClassification: 'publica', deployment: 'saas', userScope: 'area' },
  'Pronóstico de ocupación y tarifas': { aiType: 'predictivo', valueType: 'ingresos', dataClassification: 'confidencial', deployment: 'cloud_propia', userScope: 'area' },
  'Transcripción de juntas con app gratuita': { aiType: 'gen_texto', valueType: 'productividad', dataClassification: 'confidencial', deployment: 'saas', userScope: 'empresa' },
  'Filtro de CVs para reclutamiento': { aiType: 'clasificacion', valueType: 'productividad', dataClassification: 'personales', deployment: 'embebida', userScope: 'area' },
  'Copiloto para ventas corporativas': { aiType: 'copiloto', valueType: 'ingresos', dataClassification: 'confidencial', deployment: 'saas', userScope: 'area' },
  'Detección de fraude en pagos': { aiType: 'clasificacion', valueType: 'riesgo', dataClassification: 'sensibles', deployment: 'saas', userScope: 'area' },
  'Contenido para redes sociales': { aiType: 'gen_multimedia', valueType: 'experiencia', dataClassification: 'publica', deployment: 'saas', userScope: 'area' },
  'Asistente interno de políticas y manuales': { aiType: 'copiloto', valueType: 'productividad', dataClassification: 'interna', deployment: 'cloud_propia', userScope: 'empresa' },
  'Evaluación automática de crédito a agencias': { aiType: 'predictivo', valueType: 'riesgo', dataClassification: 'sensibles', deployment: 'api', userScope: 'socios' },
};

type AgentSeed = {
  name: string;
  platform: string;
  publisher: string;
  channel: string;
  owner?: string;
  status?: string;
  risk?: string;
  managed?: boolean;
  useCase?: string;
  data: string[];
  caps: string[];
  users: number;
  idle?: number;
  desc: string;
};

const AGENTS: AgentSeed[] = [
  { name: 'Concierge WhatsApp', platform: 'azure_foundry', publisher: 'Organización', channel: 'WhatsApp', owner: 'Mariana López', risk: 'Medio', useCase: 'Asistente de reservaciones por WhatsApp', data: ['PMS de reservaciones', 'Tarifas'], caps: ['Responder dudas', 'Crear prerreservas'], users: 4200, desc: 'Atiende huéspedes por WhatsApp, cotiza y crea prerreservas que confirma un agente.' },
  { name: 'Cotizador de grupos', platform: 'azure_foundry', publisher: 'Organización', channel: 'Web', owner: 'Diego Ramos', risk: 'Medio', data: ['Tarifas', 'CRM de ventas'], caps: ['Cotizar eventos'], users: 180, desc: 'Arma cotizaciones de grupos y bodas con tarifas vigentes.' },
  { name: 'Copiloto de ventas', platform: 'copilot_studio', publisher: 'Organización', channel: 'Teams', owner: 'Diego Ramos', risk: 'Medio', useCase: 'Copiloto para ventas corporativas', data: ['CRM de ventas', 'SharePoint de ventas'], caps: ['Resumir cuentas', 'Redactar propuestas'], users: 35, desc: 'Prepara reuniones con clientes corporativos y redacta propuestas.' },
  { name: 'Mesa de ayuda TI', platform: 'copilot_studio', publisher: 'Organización', channel: 'Teams', owner: 'Carlos Méndez', risk: 'Bajo', data: ['Base de conocimiento TI'], caps: ['Restablecer contraseñas', 'Abrir tickets'], users: 410, desc: 'Responde dudas de TI y abre tickets en la mesa de servicio.' },
  { name: 'Políticas internas', platform: 'copilot_studio', publisher: 'Organización', channel: 'Teams', owner: 'Jorge Pérez', risk: 'Bajo', useCase: 'Asistente interno de políticas y manuales', data: ['SharePoint de políticas'], caps: ['Responder sobre políticas'], users: 520, desc: 'Contesta preguntas sobre manuales, políticas y procedimientos.' },
  { name: 'Onboarding de personal', platform: 'copilot_studio', publisher: 'Organización', channel: 'Teams', owner: 'Recursos humanos', risk: 'Medio', data: ['SharePoint de RH', 'Nómina'], caps: ['Guiar el primer día'], users: 60, desc: 'Acompaña a personal nuevo con trámites y capacitación inicial.' },
  { name: 'Agente de compras', platform: 'copilot_studio', publisher: 'Organización', channel: 'Teams', risk: 'Medio', managed: false, data: ['ERP de compras'], caps: ['Comparar proveedores'], users: 22, desc: 'Compara cotizaciones de proveedores; creado por el área sin registro formal.' },
  { name: 'Researcher', platform: 'agent_builder', publisher: 'Microsoft', channel: 'Teams', owner: 'Carlos Méndez', risk: 'Bajo', data: ['Microsoft 365'], caps: ['Investigar', 'Resumir'], users: 140, desc: 'Agente de Microsoft para investigación con fuentes internas y web.' },
  { name: 'Analyst', platform: 'agent_builder', publisher: 'Microsoft', channel: 'Teams', owner: 'Carlos Méndez', risk: 'Bajo', data: ['Microsoft 365', 'Excel de ocupación'], caps: ['Analizar datos'], users: 48, desc: 'Agente de Microsoft para análisis de hojas de cálculo.' },
  { name: 'Resumen de juntas de gerencia', platform: 'agent_builder', publisher: 'Organización', channel: 'Teams', owner: 'Ana Ruiz', risk: 'Medio', data: ['Grabaciones de Teams'], caps: ['Resumir juntas', 'Asignar pendientes'], users: 25, desc: 'Resume juntas de gerencia y lista acuerdos.' },
  { name: 'Planificador de turnos', platform: 'agent_builder', publisher: 'Organización', channel: 'Teams', risk: 'Medio', managed: false, data: ['Excel de turnos'], caps: ['Proponer turnos'], users: 15, desc: 'Propone turnos de recepción; hecho por un gerente de hotel.' },
  { name: 'Pronóstico de ocupación', platform: 'vertex', publisher: 'Organización', channel: 'API', owner: 'Ricardo Salas', risk: 'Medio', useCase: 'Pronóstico de ocupación y tarifas', data: ['Histórico de ocupación', 'Tarifas'], caps: ['Pronosticar demanda'], users: 12, desc: 'Modelo que pronostica ocupación a 90 días y sugiere tarifas.' },
  { name: 'Clasificador de correos', platform: 'gemini_ent', publisher: 'Organización', channel: 'Correo', owner: 'Mariana López', risk: 'Bajo', data: ['Buzón de reservaciones'], caps: ['Clasificar correos'], users: 30, desc: 'Etiqueta correos de reservaciones por tipo y urgencia.' },
  { name: 'Detección de fraude', platform: 'bedrock', publisher: 'Terceros', channel: 'API', owner: 'Ricardo Salas', risk: 'Alto', useCase: 'Detección de fraude en pagos', data: ['Pasarela de pagos'], caps: ['Marcar transacciones'], users: 6, desc: 'Marca transacciones sospechosas para revisión manual.' },
  { name: 'Conciliación de facturas', platform: 'bedrock', publisher: 'Organización', channel: 'Interno', owner: 'Ricardo Salas', risk: 'Medio', data: ['ERP financiero', 'Facturas SAT'], caps: ['Leer facturas', 'Conciliar'], users: 9, desc: 'Lee facturas y propone conciliaciones contables.' },
  { name: 'Respuesta a reseñas', platform: 'openai', publisher: 'Organización', channel: 'Web', owner: 'Paola Garza', risk: 'Bajo', useCase: 'Respuesta a reseñas en línea', data: ['Reseñas públicas'], caps: ['Redactar respuestas'], users: 8, desc: 'GPT que propone respuestas a reseñas de huéspedes.' },
  { name: 'Contenido de redes', platform: 'openai', publisher: 'Organización', channel: 'Web', owner: 'Paola Garza', risk: 'Bajo', useCase: 'Contenido para redes sociales', data: ['Banco de fotos'], caps: ['Redactar posts', 'Generar imágenes'], users: 6, desc: 'GPT para calendario y textos de redes sociales.' },
  { name: 'GPT de contratos', platform: 'openai', publisher: 'Terceros', channel: 'Web', risk: 'Alto', managed: false, data: ['Contratos de proveedores'], caps: ['Revisar contratos'], users: 4, desc: 'GPT público usado por un abogado externo con contratos reales.' },
  { name: 'Traductor de menús', platform: 'openai', publisher: 'Terceros', channel: 'Web', risk: 'Bajo', managed: false, data: ['Menús'], caps: ['Traducir'], users: 11, desc: 'GPT público para traducir menús y avisos.' },
  { name: 'Asistente jurídico', platform: 'claude', publisher: 'Organización', channel: 'Web', owner: 'Laura Ortiz', risk: 'Medio', data: ['Contratos de proveedores', 'Políticas'], caps: ['Revisar cláusulas'], users: 5, desc: 'Proyecto de Claude con plantillas de contratos para revisar cláusulas de IA.' },
  { name: 'Agente de atención en web', platform: 'salesforce', publisher: 'Terceros', channel: 'Web', owner: 'Mariana López', status: 'Piloto', risk: 'Medio', data: ['CRM de ventas', 'Preguntas frecuentes'], caps: ['Responder', 'Escalar a agente'], users: 900, desc: 'Piloto de Agentforce en el sitio web de reservaciones.' },
  { name: 'Agente de incidencias', platform: 'servicenow', publisher: 'Terceros', channel: 'Interno', owner: 'Carlos Méndez', risk: 'Bajo', data: ['Mesa de servicio'], caps: ['Clasificar incidencias'], users: 70, desc: 'Clasifica y enruta incidencias de mantenimiento.' },
  { name: 'Filtro de CVs', platform: 'custom', publisher: 'Terceros', channel: 'Interno', risk: 'Alto', useCase: 'Filtro de CVs para reclutamiento', data: ['Sistema de reclutamiento'], caps: ['Puntuar candidatos'], users: 4, desc: 'Módulo del sistema de reclutamiento que ordena candidatos.' },
  { name: 'Flujo de cobranza', platform: 'n8n', publisher: 'Organización', channel: 'Correo', owner: 'Ricardo Salas', risk: 'Medio', data: ['ERP financiero', 'Buzón de cobranza'], caps: ['Enviar recordatorios'], users: 3, desc: 'Redacta y envía recordatorios de pago a agencias.' },
  { name: 'Alertas de reseñas negativas', platform: 'n8n', publisher: 'Organización', channel: 'Teams', owner: 'Paola Garza', risk: 'Bajo', data: ['Reseñas públicas'], caps: ['Alertar'], users: 12, desc: 'Avisa en Teams cuando entra una reseña de 1 o 2 estrellas.' },
  { name: 'Leads de eventos', platform: 'make', publisher: 'Organización', channel: 'Correo', risk: 'Medio', managed: false, status: 'Inactivo', idle: 70, data: ['CRM de ventas', 'Formularios web'], caps: ['Capturar leads'], users: 0, desc: 'Automatización vieja de leads; sin uso en los últimos meses.' },
  { name: 'Transcriptor de juntas', platform: 'custom', publisher: 'Terceros', channel: 'Web', risk: 'Alto', managed: false, useCase: 'Transcripción de juntas con app gratuita', data: ['Grabaciones de Teams'], caps: ['Transcribir'], users: 18, desc: 'App gratuita de transcripción usada sin contrato.' },
  { name: 'Scoring de agencias', platform: 'custom', publisher: 'Organización', channel: 'API', owner: 'Ricardo Salas', status: 'Bloqueado', risk: 'Inaceptable', useCase: 'Evaluación automática de crédito a agencias', data: ['Buró de agencias', 'ERP financiero'], caps: ['Decidir crédito'], users: 0, desc: 'Prototipo bloqueado: decidía crédito sin revisión humana.' },
];

const months = (n: number) => {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(m.toISOString().slice(0, 10));
  }
  return out;
};

/** Herramientas con uso mensual (sancionadas o no) para la telemetría. */
const USAGE: { tool: string; users: number; req: number; cost: number; growth: number; sanctioned: boolean; agent?: string; incidents?: number[] }[] = [
  { tool: 'Microsoft 365 Copilot', users: 120, req: 26000, cost: 62000, growth: 0.12, sanctioned: true },
  { tool: 'Copilot Studio', users: 520, req: 18000, cost: 14000, growth: 0.15, sanctioned: true, agent: 'Políticas internas' },
  { tool: 'Azure OpenAI', users: 3000, req: 52000, cost: 21000, growth: 0.18, sanctioned: true, agent: 'Concierge WhatsApp', incidents: [0, 1, 0, 0, 2, 1] },
  { tool: 'ChatGPT Team', users: 14, req: 3800, cost: 7400, growth: 0.05, sanctioned: true },
  { tool: 'Vertex AI', users: 12, req: 2400, cost: 5200, growth: 0.04, sanctioned: true, agent: 'Pronóstico de ocupación' },
  { tool: 'Amazon Bedrock', users: 15, req: 9000, cost: 8800, growth: 0.08, sanctioned: true, agent: 'Detección de fraude', incidents: [1, 0, 0, 1, 0, 0] },
  { tool: 'ChatGPT gratuito', users: 46, req: 5200, cost: 0, growth: -0.12, sanctioned: false, incidents: [0, 1, 1, 0, 0, 0] },
  { tool: 'Transcriptor gratuito', users: 18, req: 900, cost: 0, growth: 0.03, sanctioned: false, agent: 'Transcriptor de juntas' },
];

const DEPENDENCIES: [from: string, to: string, weight: number][] = [
  ['Comité de IA y principios de uso responsable', 'Política de uso de IA para todo el personal', 80],
  ['Comité de IA y principios de uso responsable', 'Revisión trimestral del portafolio de IA', 90],
  ['Inventario de herramientas y agentes autorizados', 'Retirar cuentas personales y gratuitas de IA', 70],
  ['Inventario de herramientas y agentes autorizados', 'Evaluación de impacto para casos de riesgo alto', 60],
  ['Clasificación de datos para uso con IA', 'Cláusulas de IA con proveedores', 75],
  ['Clasificación de datos para uso con IA', 'Retirar cuentas personales y gratuitas de IA', 40],
  ['Política de uso de IA para todo el personal', 'Capacitación por rol en uso seguro de IA', 85],
  ['Evaluación de impacto para casos de riesgo alto', 'Revisión humana obligatoria en filtro de CVs', 70],
  ['Evaluación de impacto para casos de riesgo alto', 'Pruebas de seguridad a agentes de cara al cliente', 50],
  ['Métricas de valor por caso de IA', 'Revisión trimestral del portafolio de IA', 65],
];

export async function seedDemoExtras(
  tx: GovernTx,
  orgId: string,
  caseIds: Record<string, string>,
  actionIds: Record<string, string>,
) {
  const today = Date.now();
  const agentIds: Record<string, string> = {};
  for (const a of AGENTS) {
    const [row] = await tx
      .insert(schema.aiAgents)
      .values({
        organizationId: orgId,
        name: a.name,
        description: a.desc,
        platform: a.platform,
        publisher: a.publisher,
        channel: a.channel,
        ownerName: a.owner ?? null,
        status: a.status ?? 'Activo',
        risk: a.risk ?? 'Medio',
        managed: a.managed ?? true,
        useCaseId: a.useCase ? caseIds[a.useCase] ?? null : null,
        dataSources: a.data,
        capabilities: a.caps,
        monthlyUsers: a.users,
        lastActivity: new Date(today - (a.idle ?? Math.floor(a.name.length % 5)) * 86_400_000).toISOString().slice(0, 10),
        origin: a.managed === false ? 'descubierto' : 'manual',
      })
      .returning();
    agentIds[a.name] = row!.id;
  }

  const periods = months(6);
  for (const u of USAGE) {
    for (let i = 0; i < periods.length; i++) {
      const f = Math.pow(1 + u.growth, i - (periods.length - 1));
      const wobble = 1 + (((u.tool.length * 7 + i * 13) % 9) - 4) / 100;
      await tx.insert(schema.aiUsageMetrics).values({
        organizationId: orgId,
        period: periods[i]!,
        tool: u.tool,
        agentId: u.agent ? agentIds[u.agent] ?? null : null,
        activeUsers: Math.max(1, Math.round(u.users * f * wobble)),
        requests: Math.round(u.req * f * wobble),
        costMxn: Math.round(u.cost * f * wobble),
        incidents: u.incidents?.[i] ?? 0,
        sanctioned: u.sanctioned,
        source: u.sanctioned ? 'api' : 'manual',
      });
    }
  }

  for (const [from, to, weight] of DEPENDENCIES) {
    const f = actionIds[from];
    const t = actionIds[to];
    if (f && t) await tx.insert(schema.actionDependencies).values({ organizationId: orgId, fromActionId: f, toActionId: t, weight });
  }
}
