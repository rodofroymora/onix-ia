import Link from 'next/link';
import { X } from 'lucide-react';
import { saveUseCaseAction } from '@/lib/actions/inventory';
import { completeness, feasibility, missingForPriority, suggestRisk, type CaseRow } from '@/lib/server/insights';
import { RiskDot } from '@/components/ui/RiskDot';
import { CaseAssistant } from '@/components/assistant/CaseAssistant';
import {
  AI_TYPES,
  BUSINESS_AREAS,
  DATA_CLASSES,
  DEPLOYMENTS,
  STRATEGIC_OBJECTIVES,
  TOOL_SUGGESTIONS,
  USER_SCOPES,
  VALUE_TYPES,
  VENDOR_SUGGESTIONS,
  type CatalogOption,
} from '@onix/templates';

function Pick({ name, label, options, value, hint }: { name: string; label: string; options: CatalogOption[]; value: string | null; hint?: string }) {
  return (
    <label className="block text-[12px] text-ink-muted">
      {label}
      <select name={name} defaultValue={value ?? ''} className="onix-input mt-1">
        <option value="">Elegir</option>
        {options.map((o) => (
          <option key={o.k} value={o.k} title={o.d}>
            {o.n}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-[11px] text-ink-subtle">{hint}</span> : null}
    </label>
  );
}

function Scale({ name, label, value, hint }: { name: string; label: string; value: number | null; hint?: string }) {
  return (
    <fieldset>
      <legend className="text-[12px] text-ink-muted">{label}</legend>
      <div className="mt-1.5 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} defaultChecked={value === n} className="peer sr-only" />
            <span className="flex h-8 w-9 items-center justify-center rounded-md border border-border text-[12px] tabular-nums text-ink-muted transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas">
              {n}
            </span>
          </label>
        ))}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p> : null}
    </fieldset>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-5">
      <p className="onix-label mb-3">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[13px] text-ink">
      {label}
      <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4 accent-[var(--onix-accent)]" />
    </label>
  );
}

/** Ficha del caso de IA (CU-05) en panel lateral; nunca es una pantalla nueva. */
export function CaseDrawer({
  c,
  canWrite,
  sector,
  closeHref,
  agents = [],
}: {
  c: CaseRow | null;
  canWrite: boolean;
  sector?: string | null;
  closeHref: string;
  agents?: { id: string; name: string; platform: string; risk: string; status: string; ownerName: string | null; monthlyUsers: number; managed: boolean }[];
}) {
  const RANK: Record<string, number> = { Bajo: 1, Medio: 2, Alto: 3, Inaceptable: 4 };
  const riskier = c ? agents.filter((a) => (RANK[a.risk] ?? 0) > (RANK[c.risk] ?? 0)) : [];
  const isNew = !c;
  const s = c ? suggestRisk(c, sector) : null;
  const comp = c ? completeness(c) : null;
  const missing = c ? missingForPriority(c) : [];
  const feas = c ? feasibility(c) : null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/15">
      <Link href={closeHref} className="flex-1" aria-label="Cerrar" />
      <aside className="h-full w-full max-w-[520px] overflow-y-auto border-l border-border bg-surface shadow-md">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="onix-label">{isNew ? 'Nuevo caso de IA' : 'Ficha del caso'}</p>
            <p className="mt-1 truncate text-[16px] font-semibold text-ink">{c?.name ?? 'Registrar caso'}</p>
            {c ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <RiskDot risk={c.risk} />
                <span className="text-[12px] text-ink-subtle">{c.status}</span>
                {comp ? <span className="text-[12px] text-ink-subtle">Ficha {comp.filled}/{comp.total}</span> : null}
              </div>
            ) : null}
          </div>
          <Link href={closeHref} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Link>
        </div>

        {s && c && s.level !== c.risk ? (
          <div className="mx-6 mt-5 rounded-lg border border-border bg-canvas-subtle px-4 py-3 text-[12px] text-ink-muted">
            <span className="onix-chip mr-2">Sugerencia</span>
            Por sus atributos, el triaje sugiere riesgo <span className="text-ink">{s.level}</span> ({s.why.join(', ') || 'sin factores'}). Lo valida:{' '}
            {s.validators.join(', ')}.
          </div>
        ) : null}
        {c ? (
          <div className="mx-6 mt-5 rounded-lg border border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="onix-label">Agentes que lo ejecutan</p>
              <Link href="/agentes?ambito=todos&tab=registro" className="text-[12px] text-accent hover:underline">
                Agent Discovery
              </Link>
            </div>
            {agents.length ? (
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {agents.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <Link href={`/agentes?ambito=todos&agente=${a.id}`} className="min-w-0 truncate text-ink hover:underline">
                      {a.name}
                    </Link>
                    <span className="shrink-0 text-[11px] text-ink-subtle">
                      {a.status} · {a.monthlyUsers.toLocaleString('es-MX')} usuarios · riesgo {a.risk}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[12px] text-ink-subtle">
                {c.inProduction ? 'Está en producción pero no tiene agente registrado; aparece en Agent Discovery como caso del inventario.' : 'Aún no hay agentes ligados a este caso.'}
              </p>
            )}
            {riskier.length ? (
              <p className="mt-2 text-[12px] text-warning">
                {riskier.map((a) => a.name).join(', ')} corre con riesgo {riskier[0]!.risk}, mayor al de este caso ({c.risk}). Revisa el riesgo.
              </p>
            ) : null}
          </div>
        ) : null}
        {c && missing.length ? (
          <p className="mx-6 mt-3 text-[12px] text-ink-subtle">Para priorizarlo falta: {missing.join(', ')}.</p>
        ) : null}

        <form action={saveUseCaseAction} id="case-form" className="space-y-5 px-6 py-5">
          {canWrite ? <CaseAssistant formId="case-form" /> : null}
          {c ? <input type="hidden" name="id" value={c.id} /> : null}
          <fieldset disabled={!canWrite} className="space-y-5">
            <div className="space-y-4">
              <label className="block text-[12px] text-ink-muted">
                Nombre
                <input name="name" required defaultValue={c?.name ?? ''} className="onix-input mt-1" />
              </label>
              <label className="block text-[12px] text-ink-muted">
                Qué hace
                <textarea name="description" rows={2} defaultValue={c?.description ?? ''} className="onix-input mt-1" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[12px] text-ink-muted">
                  Área
                  <select name="area" defaultValue={c?.area ?? ''} className="onix-input mt-1">
                    <option value="">Elegir</option>
                    {[...BUSINESS_AREAS, ...(c?.area && !BUSINESS_AREAS.includes(c.area) ? [c.area] : [])].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[12px] text-ink-muted">
                  Dueño
                  <input name="ownerName" defaultValue={c?.ownerName ?? ''} className="onix-input mt-1" />
                </label>
              </div>
            </div>

            <Section title="Clasificación">
              <Pick name="aiType" label="Tipo de IA" options={AI_TYPES} value={c?.aiType ?? null} />
              <div className="grid grid-cols-2 gap-3">
                <Pick name="dataClassification" label="Datos que usa" options={DATA_CLASSES} value={c?.dataClassification ?? null} />
                <Pick name="userScope" label="Quién lo usa" options={USER_SCOPES} value={c?.userScope ?? null} />
              </div>
            </Section>

            <Section title="Tecnología">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[12px] text-ink-muted">
                  Herramienta o modelo
                  <input name="technology" list="tool-options" defaultValue={c?.technology ?? ''} className="onix-input mt-1" placeholder="Elegir o escribir" />
                  <datalist id="tool-options">
                    {TOOL_SUGGESTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
                <label className="text-[12px] text-ink-muted">
                  Proveedor
                  <input name="vendor" list="vendor-options" defaultValue={c?.vendor ?? ''} className="onix-input mt-1" placeholder="Elegir o escribir" />
                  <datalist id="vendor-options">
                    {VENDOR_SUGGESTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
              </div>
              <Pick name="deployment" label="Cómo está desplegado" options={DEPLOYMENTS} value={c?.deployment ?? null} />
            </Section>

            <Section title="Impacto y autonomía">
              <Check name="usesPersonalData" label="Usa datos personales o sensibles" checked={c?.usesPersonalData ?? false} />
              <Check name="decidesOnPeople" label="Decide o recomienda sobre personas" checked={c?.decidesOnPeople ?? false} />
              <Check name="customerFacing" label="Es de cara al cliente" checked={c?.customerFacing ?? false} />
              <label className="block text-[12px] text-ink-muted">
                Autonomía
                <select name="autonomy" defaultValue={c?.autonomy ?? 'sugiere'} className="onix-input mt-1">
                  <option value="sugiere">Solo sugiere</option>
                  <option value="aprueba_humano">Actúa con aprobación de una persona</option>
                  <option value="autonomo">Actúa solo</option>
                </select>
              </label>
            </Section>

            <Section title="Valor">
              <Pick name="valueType" label="Tipo de valor" options={VALUE_TYPES} value={c?.valueType ?? null} />
              <Scale name="valueScore" label="Valor estimado" value={c?.valueScore ?? null} hint="1 bajo, 5 muy alto" />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[12px] text-ink-muted">
                  Objetivo del negocio
                  <select name="strategicObjective" defaultValue={c?.strategicObjective ?? ''} className="onix-input mt-1">
                    <option value="">Elegir</option>
                    {[...STRATEGIC_OBJECTIVES.map((o) => o.n), ...(c?.strategicObjective && !STRATEGIC_OBJECTIVES.some((o) => o.n === c.strategicObjective) ? [c.strategicObjective] : [])].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[12px] text-ink-muted">
                  Valor anual (MXN, opcional)
                  <input name="annualValue" inputMode="numeric" defaultValue={c?.annualValue ?? ''} className="onix-input mt-1" />
                </label>
              </div>
              <Scale name="strategicFit" label="Alineación con ese objetivo" value={c?.strategicFit ?? null} />
            </Section>

            <Section title={`Factibilidad${feas != null ? ` · ${feas.toFixed(1)} de 5` : ''}`}>
              <Scale name="techMaturity" label="Madurez de la tecnología" value={c?.techMaturity ?? null} hint="1 experimental, 5 probada" />
              <Scale name="integration" label="Integración con sistemas actuales" value={c?.integration ?? null} hint="1 difícil, 5 directa" />
              <Scale name="infrastructure" label="Infraestructura y licencias disponibles" value={c?.infrastructure ?? null} />
              <Scale name="skills" label="Habilidades del equipo" value={c?.skills ?? null} />
              <Scale name="dataQuality" label="Disponibilidad y calidad de datos" value={c?.dataQuality ?? null} />
              <Scale name="effort" label="Esfuerzo" value={c?.effort ?? null} hint="1 poco, 5 mucho" />
            </Section>

            <Section title="Estado">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[12px] text-ink-muted">
                  Riesgo
                  <select name="risk" defaultValue={c?.risk ?? s?.level ?? 'Medio'} className="onix-input mt-1">
                    <option>Bajo</option>
                    <option>Medio</option>
                    <option>Alto</option>
                    <option>Inaceptable</option>
                  </select>
                </label>
                <label className="text-[12px] text-ink-muted">
                  Estatus
                  <select name="status" defaultValue={c?.status ?? 'Propuesto'} className="onix-input mt-1">
                    <option>Propuesto</option>
                    <option>En revisión</option>
                    <option>Aprobado</option>
                    <option>Descartado</option>
                  </select>
                </label>
              </div>
              <input type="hidden" name="origin" value={c?.origin ?? 'manual'} />
              <Check name="inProduction" label="En producción" checked={c?.inProduction ?? false} />
            </Section>
          </fieldset>
          {canWrite ? (
            <div className="sticky bottom-0 -mx-6 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur">
              <button className="onix-btn-primary w-full">{isNew ? 'Registrar caso' : 'Guardar cambios'}</button>
            </div>
          ) : null}
        </form>
      </aside>
    </div>
  );
}
