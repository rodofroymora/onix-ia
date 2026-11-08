import {
  AREA_REG,
  AUT_RISK,
  AUT_SCALE,
  DIMS,
  LEVELS,
  QUESTIONS_PER_DIM_12,
  QUESTIONS_PER_DIM_15,
  QUESTIONS_PER_DIM_27,
  QUESTIONS_PER_DIM_38,
  RM,
  ROUTES,
  SAAS_MATURITY_COUNTS,
  SERVICIO_RIESGOS,
  SERVICIO_RUTA,
  WAVES,
} from './constants.js';
import type {
  ComputeInput,
  ComputeResult,
  DimensionKey,
  DimensionScore,
  ExtendedRisk,
  PlanActionStub,
  PlanBuildInput,
  SaaSRoute,
} from './types.js';

export function lvl(s: number): number | null {
  if (!Number.isFinite(s)) return null;
  return s < 25 ? 1 : s < 50 ? 2 : s < 75 ? 3 : 4;
}

export function low(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function entero(v: unknown, a: number, b: number): v is number {
  return typeof v === 'number' && v === Math.floor(v) && v >= a && v <= b;
}

export function autScale(aut: number): number | null {
  const v = AUT_SCALE[aut];
  return v === undefined || v === 0 ? null : v;
}

export function autRisk(aut: number): number | null {
  const v = AUT_RISK[aut];
  return v === undefined || v === 0 ? null : v;
}

export function questionsPerDim(count: number): Record<DimensionKey, number> | null {
  if (count === 12) return { ...QUESTIONS_PER_DIM_12 };
  if (count === 15) return { ...QUESTIONS_PER_DIM_15 };
  if (count === 27) return { ...QUESTIONS_PER_DIM_27 };
  if (count === 38) return { ...QUESTIONS_PER_DIM_38 };
  return null;
}

export function saasRouteForCount(count: number): SaaSRoute | null {
  if ((SAAS_MATURITY_COUNTS as readonly number[]).includes(count)) {
    return count as SaaSRoute;
  }
  return null;
}

/**
 * Agrupa respuestas de madurez por dimensión según la distribución de la ruta.
 * Legacy 12: 2 por dimensión en orden est,rol,dat,rie,seg,per.
 */
export function groupMaturityByDimension(
  m: number[],
): { averages: number[]; count: number } | null {
  const dist = questionsPerDim(m.length);
  if (!dist) return null;
  const averages: number[] = [];
  let offset = 0;
  for (const dim of DIMS) {
    const n = dist[dim.k];
    const slice = m.slice(offset, offset + n);
    if (slice.length !== n) return null;
    const avg = slice.reduce((t, v) => t + v, 0) / n;
    averages.push(avg);
    offset += n;
  }
  return { averages, count: m.length };
}

export function entradasValidas(d: ComputeInput | null | undefined): d is ComputeInput {
  if (!d || !Array.isArray(d.m)) return false;
  if (![12, 15, 27, 38].includes(d.m.length)) return false;
  for (let i = 0; i < d.m.length; i++) {
    if (!entero(d.m[i], 1, 4)) return false;
  }
  if (!entero(d.proc, 1, 4) || !entero(d.aut, 1, 4) || !entero(d.pres, 1, 4)) return false;
  if (!entero(d.datos, 1, 3) || !entero(d.afect, 1, 3)) return false;
  if (!entero(d.area, 0, 5)) return false;
  if (!autScale(d.aut) || !autRisk(d.aut)) return false;
  return true;
}

/**
 * Motor principal — API compatible con autoevaluacion-logica.js `compute`.
 * Acepta 12 (legacy) o 15/27/38 preguntas de madurez.
 */
export function compute(d: ComputeInput): ComputeResult | null {
  if (!entradasValidas(d)) return null;
  const grouped = groupMaturityByDimension(d.m);
  if (!grouped) return null;

  const dims: DimensionScore[] = DIMS.map((D, i) => {
    const a = grouped.averages[i]!;
    const s = Math.round(((a - 1) / 3) * 100);
    const level = lvl(s);
    return {
      k: D.k,
      n: D.n,
      capa: D.capa,
      labelLines: [...D.l],
      s,
      l: level ?? 0,
      i,
    };
  });

  if (dims.some((x) => !Number.isFinite(x.s) || !x.l)) return null;

  const gs = Math.round(dims.reduce((t, x) => t + x.s, 0) / dims.length);
  const minL = Math.min(...dims.map((x) => x.l));
  let gl = lvl(gs);
  let capped = false;
  if (!Number.isFinite(gs) || !gl) return null;
  if (gl > minL + 1) {
    gl = minL + 1;
    capped = true;
  }

  const capas = (['Gobierno', 'Riesgo', 'Seguridad'] as const).map((c) => {
    const ds = dims.filter((x) => x.capa === c);
    return {
      n: c,
      ds,
      s: Math.round(ds.reduce((t, x) => t + x.s, 0) / ds.length),
    };
  });

  const escala = autScale(d.aut)!;
  const P = [d.proc, escala, d.pres];
  const tipo =
    P.indexOf(4) >= 0 || P.filter((v) => v >= 3).length >= 2
      ? 2
      : P.indexOf(3) >= 0
        ? 1
        : 0;

  const factors = [
    { n: 'Datos', v: d.datos },
    { n: 'Afectados', v: d.afect },
    { n: 'Autonomía', v: autRisk(d.aut)! },
    { n: 'Regulación', v: AREA_REG[d.area]! },
  ];
  if (factors.some((f) => !entero(f.v, 1, 3))) return null;

  const risk = Math.max(...factors.map((f) => f.v));
  const highs = factors.filter((f) => f.v === 3).length;
  const sorted = dims.slice().sort((a, b) => a.s - b.s || a.i - b.i);
  const route = RM[tipo]![risk - 1];
  if (route === undefined || !Number.isFinite(route)) return null;

  return {
    dims,
    gs,
    gl,
    capped,
    minL,
    capas,
    tipo,
    risk,
    highs,
    factors,
    route,
    weak: sorted.slice(0, 3),
    strong: sorted[sorted.length - 1]!,
    escalaAut: escala,
    empate: sorted[0]!.s === sorted[sorted.length - 1]!.s,
    maturityCount: grouped.count,
    saasRoute: saasRouteForCount(grouped.count),
  };
}

export function nextService(r: ComputeResult): string {
  return r.route === 2 || r.weak[0]!.k === 'rie' || r.weak[0]!.k === 'seg'
    ? SERVICIO_RIESGOS
    : SERVICIO_RUTA;
}

export function tierRecomendada(r: ComputeResult): 1 | 2 {
  return r.gl === 1 || r.highs >= 2 || (r.route === 2 && r.gl <= 2) ? 2 : 1;
}

export function levelName(gl: number): string {
  return LEVELS[gl - 1] ?? 'Inicial';
}

export function routeName(route: number): string {
  return ROUTES[route] ?? 'Rápida';
}

/**
 * Riesgo Inaceptable: nunca se recomienda ni se marca como producción.
 */
export function isUnacceptable(risk: ExtendedRisk): boolean {
  return risk === 'Inaceptable';
}

export function canRecommendUseCase(risk: ExtendedRisk): boolean {
  return !isUnacceptable(risk);
}

export function canMarkProduction(risk: ExtendedRisk): boolean {
  return !isUnacceptable(risk);
}

/**
 * Controles Alto / Inaceptable entran a Bases como críticos no eliminables.
 */
export function criticalBasesControls(risks: ExtendedRisk[]): PlanActionStub[] {
  const out: PlanActionStub[] = [];
  for (const risk of risks) {
    if (risk !== 'Alto' && risk !== 'Inaceptable') continue;
    out.push({
      id: `ctrl-${risk.toLowerCase()}-${out.length}`,
      title:
        risk === 'Inaceptable'
          ? 'Control crítico: caso con riesgo inaceptable (bloquear producción)'
          : 'Control crítico: mitigar riesgo alto antes de operar',
      dimension: 'rie',
      stage: 'Bases',
      critical: true,
      deletable: false,
      fromRisk: risk,
    });
  }
  return out;
}

export function buildPlanActions(input: PlanBuildInput): PlanActionStub[] {
  const { compute: r, caseName, controlRisks = [] } = input;
  const weakK = r.weak.map((x) => x.k);
  const actions: PlanActionStub[] = [];

  // Controles críticos primero en Bases
  actions.push(...criticalBasesControls(controlRisks));

  for (let wi = 0; wi < WAVES.length; wi++) {
    const w = WAVES[wi]!;
    const stage = w.t;
    if (wi === 0 && r.route === 2) {
      actions.push({
        id: `wave0-risk-review`,
        title: `Revisión de riesgo de ${caseName ? `“${caseName}”` : 'tu caso principal'}`,
        dimension: 'rie',
        stage,
        critical: false,
        deletable: true,
        fromRisk: null,
      });
    }
    for (const [title, k] of w.a) {
      actions.push({
        id: `wave${wi}-${k}-${actions.length}`,
        title,
        dimension: k as DimensionKey,
        stage,
        critical: false,
        deletable: true,
        fromRisk: null,
      });
      // mark priority via sort later using weakK
      void weakK;
    }
  }

  // Priorizar acciones de dimensiones débiles dentro de cada etapa
  const stageOrder = ['Bases', 'Controles', 'Mejora continua'] as const;
  const byStage = stageOrder.flatMap((stage) => {
    const group = actions.filter((a) => a.stage === stage);
    group.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      const ap = weakK.includes(a.dimension) ? 1 : 0;
      const bp = weakK.includes(b.dimension) ? 1 : 0;
      return bp - ap;
    });
    return group;
  });

  return byStage;
}
