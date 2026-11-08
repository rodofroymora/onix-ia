import type {
  DimensionDef,
  DimensionKey,
  LevelName,
  PrioritizationWeights,
  RouteName,
  RiskName,
  StageName,
  TypeName,
} from './types.js';

export const SERVICIO_RUTA = 'Ruta IA';
export const SERVICIO_RIESGOS = 'Revisión de riesgos de IA';

export const DIMS: readonly DimensionDef[] = [
  { k: 'est', n: 'Estrategia y valor', capa: 'Gobierno', l: ['Estrategia', 'y valor'] },
  { k: 'rol', n: 'Roles y decisiones', capa: 'Gobierno', l: ['Roles y', 'decisiones'] },
  { k: 'dat', n: 'Datos y privacidad', capa: 'Riesgo', l: ['Datos y', 'privacidad'] },
  { k: 'rie', n: 'Riesgo y control', capa: 'Riesgo', l: ['Riesgo y', 'control'] },
  { k: 'seg', n: 'Seguridad y tecnología', capa: 'Seguridad', l: ['Seguridad y', 'tecnología'] },
  { k: 'per', n: 'Personas y cultura', capa: 'Gobierno', l: ['Personas y', 'cultura'] },
] as const;

export const DIM_KEYS: readonly DimensionKey[] = DIMS.map((d) => d.k);

export const LEVELS: readonly LevelName[] = [
  'Inicial',
  'En exploración',
  'Definido',
  'Gestionado',
] as const;

export const ROUTES: readonly RouteName[] = ['Rápida', 'Estándar', 'Completa'] as const;
export const RISKS: readonly RiskName[] = ['Bajo', 'Medio', 'Alto'] as const;
export const TYPES: readonly TypeName[] = ['Cotidiano', 'En transición', 'Transformador'] as const;
export const STAGES: readonly StageName[] = ['Bases', 'Controles', 'Mejora continua'] as const;

export const AREAS = [
  'Atención a clientes',
  'Marketing y contenido',
  'Personal y reclutamiento',
  'Finanzas y crédito',
  'Operación interna',
  'Otra área',
] as const;

/** Regulación por área (1–3). */
export const AREA_REG = [2, 2, 3, 3, 1, 1] as const;

/** Escala de autonomía (tipo de caso). */
export const AUT_SCALE = [0, 1, 3, 3, 4] as const;
/** Riesgo del factor Autonomía. */
export const AUT_RISK = [0, 1, 3, 2, 3] as const;

/** Matriz ruta: tipo × riesgo → índice de ruta (0 Rápida, 1 Estándar, 2 Completa). */
export const RM: readonly (readonly number[])[] = [
  [0, 1, 2],
  [1, 1, 2],
  [1, 2, 2],
];

export const RC = ['c-ok', 'c-rev', 'c-alto'] as const;

/** Preguntas de madurez por ruta SaaS. */
export const SAAS_MATURITY_COUNTS = [15, 27, 38] as const;

/** Distribución conceptual de preguntas por dimensión para 38 (Completa). */
export const QUESTIONS_PER_DIM_38: Record<DimensionKey, number> = {
  est: 7,
  rol: 6,
  dat: 7,
  rie: 6,
  seg: 6,
  per: 6,
};

/** Para 27 (Estándar): ~4–5 por dimensión. */
export const QUESTIONS_PER_DIM_27: Record<DimensionKey, number> = {
  est: 5,
  rol: 4,
  dat: 5,
  rie: 4,
  seg: 5,
  per: 4,
};

/** Para 15 (Rápida): ~2–3 por dimensión. */
export const QUESTIONS_PER_DIM_15: Record<DimensionKey, number> = {
  est: 3,
  rol: 2,
  dat: 3,
  rie: 2,
  seg: 3,
  per: 2,
};

/** Legacy: 2 por dimensión (12). */
export const QUESTIONS_PER_DIM_12: Record<DimensionKey, number> = {
  est: 2,
  rol: 2,
  dat: 2,
  rie: 2,
  seg: 2,
  per: 2,
};

export const DEFAULT_PRIORITIZATION_WEIGHTS: PrioritizationWeights = {
  impactoNegocio: 0.25,
  urgenciaRegulatoria: 0.2,
  facilidadImplementacion: 0.15,
  dependenciaOtros: 0.1,
  riesgoResidual: 0.2,
  valorAprendizaje: 0.1,
};

/** Tope: +1.5 puntos de índice / 12 meses (escala 0–100). */
export const MAX_POINTS_PER_12_MONTHS = 1.5;
/** Meses mínimos operando para alcanzar Gestionado. */
export const GESTIONADO_MIN_MONTHS = 3;
/** Máximo avance de nivel por ciclo. */
export const MAX_LEVEL_GAIN_PER_CYCLE = 1;

export const ACTION_PROGRESS_STEPS = [0, 25, 50, 75, 100] as const;

export const WAVES = [
  {
    n: 'Etapa 1 · Bases',
    t: 'Bases' as const,
    hz: 'Para empezar',
    a: [
      ['Principios de responsabilidad y ética de IA', 'rol'],
      ['Inventario de herramientas y agentes autorizados', 'rol'],
      ['Políticas de datos', 'dat'],
      ['Política de uso de IA', 'per'],
    ] as const,
  },
  {
    n: 'Etapa 2 · Controles',
    t: 'Controles' as const,
    hz: 'Cuando las bases estén listas',
    a: [
      ['Evaluación de riesgos con un marco para LLM', 'rie'],
      ['Pruebas antes de operar', 'seg'],
      ['Supervisión humana (HITL) según el impacto', 'rie'],
      ['Metas y métricas de valor por caso', 'est'],
    ] as const,
  },
  {
    n: 'Etapa 3 · Mejora continua',
    t: 'Mejora continua' as const,
    hz: 'Para sostenerlo',
    a: [
      ['Monitoreo en operación', 'seg'],
      ['Reevaluación ante cambios de modelo o datos', 'rie'],
      ['Capacitación por rol', 'per'],
      ['Revisión periódica de política y valor', 'est'],
    ] as const,
  },
] as const;

export const SAMPLE: {
  m: number[];
  name: string;
  proc: number;
  aut: number;
  pres: number;
  datos: number;
  afect: number;
  area: number;
  org: string;
  sample: boolean;
} = {
  m: [2, 1, 2, 1, 2, 2, 1, 2, 3, 1, 1, 2],
  name: 'Asistente de WhatsApp para cotizaciones',
  proc: 2,
  aut: 3,
  pres: 2,
  datos: 2,
  afect: 3,
  area: 0,
  org: 'Empresa Ejemplo',
  sample: true,
};
