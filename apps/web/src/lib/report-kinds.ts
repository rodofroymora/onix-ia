export type ReportKind = 'evaluacion' | 'direccion' | 'avance';

export const REPORT_KINDS: Record<ReportKind, { n: string; d: string }> = {
  evaluacion: {
    n: 'Informe de evaluación',
    d: 'Madurez por dimensión, hallazgos, inventario, prioridades y plan. Para el comité o el equipo responsable.',
  },
  direccion: {
    n: 'Resumen para dirección',
    d: 'Una página: dónde estamos, qué cambió y qué decidir. Para el consejo o la dirección general.',
  },
  avance: {
    n: 'Avance del plan',
    d: 'Acciones cerradas con evidencia, pendientes críticas y madurez proyectada. Para el seguimiento mensual.',
  },
};

/** Informes viejos guardaban kind = revision_inicial. */
export function reportKind(k: string): ReportKind {
  return k in REPORT_KINDS ? (k as ReportKind) : 'evaluacion';
}
