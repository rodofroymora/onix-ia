/** Tipos del motor de madurez Ónix Govern. Sin acceso a BD. */

export type DimensionKey = 'est' | 'rol' | 'dat' | 'rie' | 'seg' | 'per';
export type Capa = 'Gobierno' | 'Riesgo' | 'Seguridad';
export type LevelName = 'Inicial' | 'En exploración' | 'Definido' | 'Gestionado';
export type RouteName = 'Rápida' | 'Estándar' | 'Completa';
export type RiskName = 'Bajo' | 'Medio' | 'Alto';
export type TypeName = 'Cotidiano' | 'En transición' | 'Transformador';
export type StageName = 'Bases' | 'Controles' | 'Mejora continua';

/** Nivel de riesgo extendido (casos de uso / controles). */
export type ExtendedRisk = 'Bajo' | 'Medio' | 'Alto' | 'Inaceptable';

/** Rutas SaaS por cantidad de preguntas de madurez. */
export type SaaSRoute = 15 | 27 | 38;

export interface DimensionDef {
  k: DimensionKey;
  n: string;
  capa: Capa;
  /** Líneas de etiqueta para radar / UI. */
  l: string[];
}

export interface DimensionScore {
  k: DimensionKey;
  n: string;
  capa: Capa;
  /** Líneas de etiqueta (heredadas de DimensionDef). */
  labelLines: string[];
  s: number;
  /** Nivel 1–4. */
  l: number;
  i: number;
}

export interface CapaScore {
  n: Capa;
  ds: DimensionScore[];
  s: number;
}

export interface RiskFactor {
  n: string;
  v: number;
}

/**
 * Entrada compatible con autoevaluacion-logica.js (12 madurez + factores de caso).
 * `m` puede ser 12 (legacy) o un arreglo expandido; compute normaliza a 6 dimensiones.
 */
export interface ComputeInput {
  /** Respuestas de madurez 1–4. Legacy: 12 (2 por dimensión). Expandido: 15/27/38. */
  m: number[];
  proc: number;
  aut: number;
  pres: number;
  datos: number;
  afect: number;
  area: number;
  name?: string;
  org?: string;
  sample?: boolean;
}

export interface ComputeResult {
  dims: DimensionScore[];
  gs: number;
  gl: number;
  capped: boolean;
  minL: number;
  capas: CapaScore[];
  tipo: number;
  risk: number;
  highs: number;
  factors: RiskFactor[];
  route: number;
  weak: DimensionScore[];
  strong: DimensionScore;
  escalaAut: number;
  empate: boolean;
  /** Preguntas de madurez usadas (12 | 15 | 27 | 38). */
  maturityCount: number;
  saasRoute: SaaSRoute | null;
}

export interface Gap {
  from: DimensionKey;
  to: DimensionKey;
  fromLevel: number;
  toLevel: number;
  delta: number;
}

export type ValidatorOpinion = number;

export interface TriageInput {
  /** Opiniones de validadores (niveles 1–4 o factores 1–3). */
  opinions: ValidatorOpinion[];
}

export interface TriageResult {
  agreed: boolean;
  value: number;
  max: number;
  min: number;
}

/** Criterios ponderados de priorización (6). */
export interface PrioritizationCriteria {
  impactoNegocio: number;
  urgenciaRegulatoria: number;
  facilidadImplementacion: number;
  dependenciaOtros: number;
  riesgoResidual: number;
  valorAprendizaje: number;
}

export interface PrioritizationWeights {
  impactoNegocio: number;
  urgenciaRegulatoria: number;
  facilidadImplementacion: number;
  dependenciaOtros: number;
  riesgoResidual: number;
  valorAprendizaje: number;
}

export interface PrioritizationResult {
  score: number;
  normalized: number;
  weights: PrioritizationWeights;
  criteria: PrioritizationCriteria;
}

export interface ProjectedMaturityInput {
  currentLevel: number;
  currentScore: number;
  /** Puntos ganados en el ciclo (0–100 escala de índice). */
  cycleGainPoints: number;
  /** Meses operando en el nivel actual (para Gestionado). */
  monthsOperating: number;
  /** Puntos ganados en los últimos 12 meses. */
  pointsLast12Months: number;
}

export interface ProjectedMaturityResult {
  projectedLevel: number;
  projectedScore: number;
  cappedLevel: boolean;
  cappedPoints: boolean;
  blockedGestionado: boolean;
  reasons: string[];
}

export type ActionProgress = 0 | 25 | 50 | 75 | 100;
export type EvidenceStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface ActionProgressInput {
  claimed: ActionProgress;
  evidenceStatus: EvidenceStatus;
}

export interface ActionProgressResult {
  progress: ActionProgress;
  blockedClose: boolean;
  reason: string | null;
}

export interface ControlRiskInput {
  risk: ExtendedRisk;
}

export interface PlanActionStub {
  id: string;
  title: string;
  dimension: DimensionKey;
  stage: StageName;
  critical: boolean;
  deletable: boolean;
  fromRisk: ExtendedRisk | null;
}

export interface PlanBuildInput {
  compute: ComputeResult;
  caseName?: string;
  controlRisks?: ExtendedRisk[];
}
