/** 8 plantillas sectoriales (stubs). */

export interface SectorTemplate {
  id: string;
  name: string;
  description: string;
  focusDimensions: string[];
  sampleUseCases: string[];
}

export const SECTOR_TEMPLATES: SectorTemplate[] = [
  {
    id: 'hospitalidad',
    name: 'Hospitalidad y turismo',
    description: 'Hoteles, resorts y operadores turísticos.',
    focusDimensions: ['per', 'dat', 'est'],
    sampleUseCases: ['Asistente de reservaciones', 'Resumen de reseñas'],
  },
  {
    id: 'salud',
    name: 'Salud',
    description: 'Clínicas y prestadores de servicios de salud.',
    focusDimensions: ['dat', 'rie', 'seg'],
    sampleUseCases: ['Triaje informativo', 'Codificación administrativa'],
  },
  {
    id: 'finanzas',
    name: 'Finanzas y crédito',
    description: 'SOFOMES, fintech y áreas de crédito.',
    focusDimensions: ['rie', 'dat', 'rol'],
    sampleUseCases: ['Scoring asistido', 'Atención a usuarios'],
  },
  {
    id: 'retail',
    name: 'Retail y comercio',
    description: 'Comercio físico y electrónico.',
    focusDimensions: ['est', 'seg', 'per'],
    sampleUseCases: ['Recomendaciones de catálogo', 'Atención postventa'],
  },
  {
    id: 'manufactura',
    name: 'Manufactura',
    description: 'Plantas y cadenas de suministro.',
    focusDimensions: ['seg', 'rie', 'est'],
    sampleUseCases: ['Mantenimiento predictivo asistido', 'Control de calidad visual'],
  },
  {
    id: 'educacion',
    name: 'Educación',
    description: 'Instituciones educativas y edtech.',
    focusDimensions: ['per', 'dat', 'est'],
    sampleUseCases: ['Tutoría asistida', 'Generación de materiales'],
  },
  {
    id: 'gobierno',
    name: 'Sector público',
    description: 'Dependencias y organismos públicos.',
    focusDimensions: ['rol', 'dat', 'rie'],
    sampleUseCases: ['Orientación ciudadana', 'Clasificación de trámites'],
  },
  {
    id: 'servicios-profesionales',
    name: 'Servicios profesionales',
    description: 'Consultoría, legal y contabilidad.',
    focusDimensions: ['dat', 'per', 'est'],
    sampleUseCases: ['Borradores de documentos', 'Investigación asistida'],
  },
];
