import { describe, expect, it } from 'vitest';
import { AI_TYPES, catalogName, inCatalog } from '@onix/templates';
import { searchAgents, type AgentRow } from '@/lib/server/agents';
import { matchHelp } from '@/lib/server/help';

const agent = (p: Partial<AgentRow>): AgentRow =>
  ({
    id: p.name ?? 'x',
    name: 'Agente',
    description: null,
    dataSources: [],
    capabilities: [],
    useCaseName: null,
    platformName: 'Copilot Studio',
    vendor: 'Microsoft',
    channel: 'Teams',
    ownerName: null,
    ...p,
  }) as AgentRow;

describe('listas estándar', () => {
  it('solo acepta claves del catálogo', () => {
    expect(inCatalog(AI_TYPES, 'agente')).toBe('agente');
    expect(inCatalog(AI_TYPES, 'inventado')).toBeNull();
    expect(catalogName(AI_TYPES, 'predictivo')).toBe('Modelo predictivo');
  });
});

describe('búsqueda por contexto de agentes', () => {
  const agents = [
    agent({ name: 'GPT de contratos', description: 'Revisa contratos de proveedores', capabilities: ['Revisar contratos'] }),
    agent({ name: 'Asistente jurídico', description: 'Cláusulas de IA', dataSources: ['Contratos de proveedores'] }),
    agent({ name: 'Cotizador de grupos', description: 'Cotiza eventos', dataSources: ['CRM de ventas'] }),
  ];

  it('encuentra lo relacionado con contratos y no mete ventas', () => {
    const ids = searchAgents('¿hay algo que lea contratos?', agents).map((h) => h.id);
    expect(ids[0]).toBe('GPT de contratos');
    expect(ids).toContain('Asistente jurídico');
    expect(ids).not.toContain('Cotizador de grupos');
  });

  it('usa sinónimos del negocio', () => {
    const ids = searchAgents('algo legal', agents).map((h) => h.id);
    expect(ids).toContain('GPT de contratos');
  });
});

describe('guía del asistente', () => {
  it('responde dudas de uso con la sección correcta', () => {
    expect(matchHelp('¿Cómo invito a un responsable?')?.k).toBe('evaluacion');
    expect(matchHelp('¿cómo agrego una dependencia en el plan?')?.k).toBe('plan');
    expect(matchHelp('xyz')).toBeNull();
  });
});
