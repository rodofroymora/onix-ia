/** Biblioteca de acciones orientativas (no certificación). */

export interface ActionTemplate {
  id: string;
  title: string;
  dimension: 'est' | 'rol' | 'dat' | 'rie' | 'seg' | 'per';
  stage: 'Bases' | 'Controles' | 'Mejora continua';
  summary: string;
}

export const ACTION_LIBRARY: ActionTemplate[] = [
  {
    id: 'act-principios',
    title: 'Principios de responsabilidad y ética de IA',
    dimension: 'rol',
    stage: 'Bases',
    summary: 'Acuerda principios claros y un responsable o comité.',
  },
  {
    id: 'act-inventario',
    title: 'Inventario de herramientas y agentes autorizados',
    dimension: 'rol',
    stage: 'Bases',
    summary: 'Lista actualizada con dueño, datos permitidos y estado.',
  },
  {
    id: 'act-politicas-datos',
    title: 'Políticas de datos para IA',
    dimension: 'dat',
    stage: 'Bases',
    summary: 'Clasificación de información y reglas por herramienta.',
  },
  {
    id: 'act-politica-uso',
    title: 'Política de uso de IA',
    dimension: 'per',
    stage: 'Bases',
    summary: 'Documento corto, comunicado y con aceptación formal.',
  },
  {
    id: 'act-eval-riesgos',
    title: 'Evaluación de riesgos con marco para LLM',
    dimension: 'rie',
    stage: 'Controles',
    summary: 'Revisa riesgos antes de lanzar; define supervisión humana.',
  },
  {
    id: 'act-pruebas',
    title: 'Pruebas antes de operar',
    dimension: 'seg',
    stage: 'Controles',
    summary: 'Casos reales y de ataque antes de poner en producción.',
  },
  {
    id: 'act-hitl',
    title: 'Supervisión humana (HITL) según impacto',
    dimension: 'rie',
    stage: 'Controles',
    summary: 'Define compuertas humanas por nivel de impacto.',
  },
  {
    id: 'act-metricas',
    title: 'Metas y métricas de valor por caso',
    dimension: 'est',
    stage: 'Controles',
    summary: 'Línea base, meta y dueño del resultado.',
  },
  {
    id: 'act-monitoreo',
    title: 'Monitoreo en operación',
    dimension: 'seg',
    stage: 'Mejora continua',
    summary: 'Desempeño, costos e incidentes con alertas.',
  },
  {
    id: 'act-reeval',
    title: 'Reevaluación ante cambios de modelo o datos',
    dimension: 'rie',
    stage: 'Mejora continua',
    summary: 'Vuelve a revisar cuando cambie el modelo o la fuente.',
  },
  {
    id: 'act-capacitacion',
    title: 'Capacitación por rol',
    dimension: 'per',
    stage: 'Mejora continua',
    summary: 'Dirección, usuarios y constructores reciben lo que les toca.',
  },
  {
    id: 'act-revision-periodica',
    title: 'Revisión periódica de política y valor',
    dimension: 'est',
    stage: 'Mejora continua',
    summary: 'Compara resultados contra la línea base y actualiza reglas.',
  },
];
