import { ACTION_LIBRARY, AI_CATALOG, SECTOR_TEMPLATES } from '@onix/templates';
import { loadAuditLog } from '@/lib/server/org-data';
import { FEATURES } from '@/lib/features';
import { requireConsultant } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';

export default async function AdministracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireConsultant();
  const params = await searchParams;
  const tab = params.tab ?? 'plantillas';
  const audit = await loadAuditLog(session.user.organizationId);

  const tabs = [
    { id: 'plantillas', label: 'Plantillas' },
    { id: 'acciones', label: 'Biblioteca de acciones' },
    { id: 'catalogo', label: 'Catálogo IA' },
    { id: 'auditoria', label: 'Bitácora' },
  ];

  return (
    <div>
      <PageHeader
        title="Administración"
        eyebrow="Solo consultores"
        description="Plantillas por sector, biblioteca de acciones, catálogo de herramientas de IA y bitácora de cambios (no se puede editar ni borrar)."
      />
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/administracion?tab=${t.id}`}
            className={`onix-tab ${tab === t.id ? 'onix-tab-active' : ''}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'plantillas' ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECTOR_TEMPLATES.map((t) => (
              <li key={t.id} className="onix-panel p-4">
                <p className="text-sm font-medium text-ink">{t.name}</p>
                <p className="mt-1 text-xs text-ink-muted">{t.description}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === 'acciones' ? (
          <ul className="divide-y divide-border onix-panel">
            {ACTION_LIBRARY.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p className="text-ink">{a.title}</p>
                <p className="text-xs text-ink-muted">
                  {a.stage} · {a.dimension} · {a.summary}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === 'catalogo' ? (
          <ul className="divide-y divide-border onix-panel">
            {AI_CATALOG.map((c) => (
              <li key={c.id} className="px-4 py-3 text-sm">
                <p className="text-ink">{c.name}</p>
                <p className="text-xs text-ink-muted">
                  {c.category} · riesgo {c.typicalRisk}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === 'auditoria' ? (
          <ul className="divide-y divide-border onix-panel">
            {audit.map((row) => (
              <li key={row.id} className="px-4 py-3 text-xs">
                <p className="text-ink">
                  {row.action} · {row.entityType}
                </p>
                <p className="text-ink-subtle">{row.createdAt?.toISOString?.() ?? String(row.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {FEATURES.assistant ? (
          <p className="mt-4 text-xs text-ink-subtle">
            Asistente activo (FEATURE_ASSISTANT): solo stubs de resumen y borrador de informe.
          </p>
        ) : null}
      </div>
    </div>
  );
}
