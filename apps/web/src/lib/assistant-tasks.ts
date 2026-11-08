import type { AssistantTask } from '@/lib/server/narrative';

/** Funciones básicas del asistente según la pantalla. */
export const TASKS_BY_VIEW: { prefix: string; label: string; tasks: { k: AssistantTask; n: string; d: string }[] }[] = [
  { prefix: '/evaluacion', label: 'Evaluación', tasks: [
    { k: 'hallazgos', n: 'Hallazgos clave', d: 'Lo que más importa de las respuestas' },
    { k: 'preguntas_entrevista', n: 'Preguntas para la entrevista', d: 'Desde los desacuerdos y los "No sé"' },
    { k: 'mensaje_invitacion', n: 'Mensaje de invitación', d: 'Texto listo para WhatsApp o correo' },
  ] },
  { prefix: '/inventario', label: 'Inventario', tasks: [
    { k: 'inventario_resumen', n: 'Resumen del inventario', d: 'Qué hay, dónde y con qué riesgo' },
    { k: 'casos_controles', n: 'Casos que necesitan controles', d: 'Antes de escalar o seguir en producción' },
    { k: 'fichas_incompletas', n: 'Fichas incompletas', d: 'Qué dato falta en cada caso' },
  ] },
  { prefix: '/priorizacion', label: 'Priorización', tasks: [
    { k: 'que_hacer_primero', n: 'Qué hacer primero', d: 'Recomendación para este trimestre' },
    { k: 'explicar_ranking', n: 'Explicar el ranking', d: 'Por qué cada caso quedó donde quedó' },
  ] },
  { prefix: '/plan', label: 'Plan', tasks: [
    { k: 'siguientes_pasos', n: 'Siguientes pasos', d: 'Las próximas cuatro semanas' },
    { k: 'bloqueos_plan', n: 'Qué está bloqueado', d: 'Vencidas y dependencias por destrabar' },
    { k: 'avance_comite', n: 'Avance para el comité', d: 'Actualización corta lista para enviar' },
  ] },
  { prefix: '/reportes', label: 'Reportes', tasks: [
    { k: 'resumen_ejecutivo', n: 'Resumen para dirección', d: 'Dónde estamos y qué decidir' },
    { k: 'correo_direccion', n: 'Correo para dirección', d: 'Para acompañar el informe' },
  ] },
  { prefix: '/agentes', label: 'Agent Discovery', tasks: [
    { k: 'agentes_atencion', n: 'Agentes que requieren atención', d: 'Riesgo, sin dueño o sin caso' },
    { k: 'uso_no_autorizado', n: 'Uso no autorizado', d: 'Qué se ve y cómo reducirlo' },
  ] },
  { prefix: '/telemetria', label: 'Telemetría', tasks: [
    { k: 'lectura_telemetria', n: 'Lectura del mes', d: 'Tendencias, herramientas e incidentes' },
    { k: 'optimizar_costo', n: 'Dónde optimizar costo', d: 'Según el uso de cada herramienta' },
    { k: 'uso_no_autorizado', n: 'Uso no autorizado', d: 'Qué se ve y cómo reducirlo' },
  ] },
  { prefix: '/organizacion', label: 'Organización', tasks: [
    { k: 'huecos_responsables', n: 'Huecos de responsables', d: 'Funciones sin cubrir y su impacto' },
  ] },
  { prefix: '/', label: 'Inicio', tasks: [
    { k: 'resumen_ejecutivo', n: 'Resumen para dirección', d: 'Dónde estamos, qué cambió y qué decidir' },
    { k: 'hallazgos', n: 'Hallazgos clave', d: 'Los tres puntos que más importan' },
    { k: 'siguientes_pasos', n: 'Siguientes pasos', d: 'Qué hacer en las próximas cuatro semanas' },
  ] },
];


export function tasksForPath(path: string) {
  return TASKS_BY_VIEW.find((v) => (v.prefix === '/' ? path === '/' : path.startsWith(v.prefix))) ?? TASKS_BY_VIEW.at(-1)!;
}
