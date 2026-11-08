/** Catálogo orientativo de usos de IA (stubs). */

export interface AICatalogEntry {
  id: string;
  name: string;
  category: string;
  typicalRisk: 'Bajo' | 'Medio' | 'Alto' | 'Inaceptable';
  notes: string;
}

export const AI_CATALOG: AICatalogEntry[] = [
  {
    id: 'cat-asistente-interno',
    name: 'Asistente interno de productividad',
    category: 'Productividad',
    typicalRisk: 'Bajo',
    notes: 'Uso con datos no sensibles y cuentas empresariales.',
  },
  {
    id: 'cat-atencion-clientes',
    name: 'Atención a clientes con IA',
    category: 'Atención',
    typicalRisk: 'Medio',
    notes: 'Requiere supervisión y aviso cuando interactúa con personas.',
  },
  {
    id: 'cat-credito',
    name: 'Apoyo a decisiones de crédito',
    category: 'Finanzas',
    typicalRisk: 'Alto',
    notes: 'No automatizar rechazos sin revisión humana y registro.',
  },
  {
    id: 'cat-rrhh-seleccion',
    name: 'Filtrado de candidatos',
    category: 'Personas',
    typicalRisk: 'Alto',
    notes: 'Pruebas de sesgo y supervisión obligatorias.',
  },
  {
    id: 'cat-autonomo-critico',
    name: 'Agente autónomo en decisión crítica sin HITL',
    category: 'Autonomía',
    typicalRisk: 'Inaceptable',
    notes: 'Nunca recomendado ni marcado como producción en Govern.',
  },
];
