import Link from 'next/link';
import { Check, Lock, RefreshCw, X } from 'lucide-react';
import { AWS_REGIONS, PERMISSIONS_POLICY, trustPolicy } from '@/lib/connectors/aws';
import { INTEGRATIONS, MS_SOURCES, integrationByKey, type Integration, type ParamField } from '@/lib/connectors/integrations';
import { disconnectConnectorAction, prepareAwsAction, saveMicrosoftSourcesAction, syncConnectorAction } from '@/lib/actions/connectors';
import type { ConnectorView } from '@/lib/server/connectors';
import { AwsForm, CopyBlock } from './AwsForm';

type Ready = { microsoft: boolean; aws: boolean; google: boolean };
export type IntegrationsFlash = { integracion?: string; ok?: string; nuevos?: string; error?: string; guardado?: string; cat?: string };

const CATS = ['Productividad', 'Plataformas de agentes', 'Asistentes de IA'] as const;

const ERRORS: Record<string, string> = {
  config: 'Esta integración aún no está activada en Ónix. Pídeselo a tu consultor.',
  cancelado: 'Se canceló el inicio de sesión.',
  estado: 'La conexión expiró o no coincide con tu sesión. Inténtalo de nuevo.',
  llave: 'Falta la llave de cifrado de Ónix (CONNECTOR_ENC_KEY).',
  consentimiento: 'Falta el consentimiento de un administrador de Microsoft 365.',
  microsoft: 'Microsoft no completó la conexión. Inténtalo de nuevo.',
  fuentes: 'Elige al menos una cosa que revisar.',
  sync: 'La conexión quedó, pero la revisión tuvo errores. Abajo está el detalle.',
};

const fmt = (d: Date | null) => (d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

function statusOf(i: Integration, c: ConnectorView | undefined, ready: Ready) {
  if (c?.status === 'conectado') return { n: 'Conectado', cls: 'onix-tint-success' };
  if (c?.status === 'error') return { n: 'Con error', cls: 'onix-tint-danger' };
  if (c?.status === 'pendiente') return { n: 'Por terminar', cls: 'onix-tint-warning' };
  if (c?.status === 'demo') return { n: 'Ejemplo', cls: 'onix-tint-accent' };
  if (i.availability === 'pronto') return { n: 'Próximamente', cls: 'onix-tint-muted' };
  if (!(ready as Record<string, boolean>)[i.provider]) return { n: 'Por activar', cls: 'onix-tint-muted' };
  return { n: 'Disponible', cls: 'onix-tint-muted' };
}

function Avatar({ i, size = 'md' }: { i: Integration; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`onix-glass flex shrink-0 items-center justify-center rounded-xl font-display font-semibold text-accent ${size === 'lg' ? 'h-11 w-11 text-[17px]' : 'h-9 w-9 text-[14px]'}`}
    >
      {i.initials}
    </span>
  );
}

/** Catálogo: el usuario escoge la integración y se abre su panel con los parámetros que pide. */
export function IntegrationsCatalog({ list, ready, flash, base }: { list: ConnectorView[]; ready: Ready; flash: IntegrationsFlash; base: string }) {
  const by = (p: string) => list.find((c) => c.provider === p);
  const cat = CATS.find((c) => c === flash.cat);
  const shown = INTEGRATIONS.filter((i) => !cat || i.category === cat);
  const connected = INTEGRATIONS.filter((i) => by(i.provider));
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams({ tab: 'conexiones', ...(cat ? { cat } : {}) });
    for (const [k, v] of Object.entries(patch)) v ? q.set(k, v) : q.delete(k);
    return `${base}?${q}`;
  };

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Escoge dónde vive la IA de tu organización. Ónix se conecta con permisos de solo lectura, revisa cada día y lo que encuentra llega a la pestaña
          Detectados.
        </p>
        {connected.length ? (
          <p className="text-[12px] text-ink-subtle">
            {connected.length} {connected.length === 1 ? 'conexión activa' : 'conexiones activas'}
          </p>
        ) : null}
      </div>

      <div className="onix-scroll-x mt-4 flex gap-1 text-[13px]">
        {[undefined, ...CATS].map((c) => (
          <Link
            key={c ?? 'todas'}
            href={href({ cat: c, integracion: undefined })}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 ${cat === c ? 'onix-seg-active' : 'text-ink-muted hover:text-ink'}`}
          >
            {c ?? 'Todas'}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i) => {
          const c = by(i.provider);
          const st = statusOf(i, c, ready);
          return (
            <Link
              key={i.key}
              href={href({ integracion: i.key })}
              className={`onix-panel group flex flex-col p-4 transition hover:border-accent/40 hover:shadow-sm ${i.availability === 'pronto' ? 'opacity-80' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar i={i} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{i.name}</p>
                    <p className="text-[12px] text-ink-subtle">
                      {i.vendor} · {i.category}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.n}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{i.summary}</p>
              <p className="mt-auto pt-3 text-[12px] text-ink-subtle">
                {c?.lastSyncAt ? `Revisado ${fmt(c.lastSyncAt)}${c.summary.found != null ? ` · ${c.summary.found} encontrados` : ''}` : i.availability === 'pronto' ? 'Ver qué pedirá' : 'Configurar'}
                <span className="ml-1 text-accent opacity-0 transition group-hover:opacity-100">→</span>
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Panel lateral de una integración: qué descubre, qué permisos pide y sus parámetros. */
export function IntegrationDrawer({
  integrationKey,
  list,
  ready,
  canWrite,
  flash,
  closeHref,
}: {
  integrationKey: string;
  list: ConnectorView[];
  ready: Ready;
  canWrite: boolean;
  flash: IntegrationsFlash;
  closeHref: string;
}) {
  const i = integrationByKey(integrationKey);
  if (!i) return null;
  const c = list.find((x) => x.provider === i.provider);
  const st = statusOf(i, c, ready);
  const isReady = (ready as Record<string, boolean>)[i.provider] ?? false;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/15">
      <Link href={closeHref} className="hidden flex-1 sm:block" aria-label="Cerrar" />
      <aside className="h-full w-full overflow-y-auto border-l border-border bg-surface shadow-md sm:max-w-[500px]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar i={i} size="lg" />
            <div className="min-w-0">
              <p className="onix-label">
                {i.vendor} · {i.category}
              </p>
              <p className="mt-0.5 truncate text-[16px] font-semibold text-ink">{i.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.n}</span>
            <Link href={closeHref} className="rounded-md p-1 text-ink-subtle hover:text-ink" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          {flash.integracion === i.key && (flash.ok || flash.error || flash.guardado) ? (
            <p className={`rounded-lg px-3 py-2 text-[13px] ${flash.error ? 'onix-tint-danger' : 'onix-tint-success'}`}>
              {flash.error
                ? ERRORS[flash.error] ?? 'No se pudo completar.'
                : flash.guardado
                  ? 'Cambios guardados. Se aplican en la próxima revisión.'
                  : `Listo. ${Number(flash.nuevos) ? `${flash.nuevos} detecciones nuevas en la pestaña Detectados.` : 'Sin detecciones nuevas.'}`}
            </p>
          ) : null}

          <p className="text-[13px] leading-relaxed text-ink-muted">{i.summary}</p>

          {c && c.status !== 'pendiente' ? <ConnectionStatus c={c} canWrite={canWrite} reconnectHref={i.provider === 'microsoft' ? '#parametros' : undefined} /> : null}

          <Block title="Qué descubre">
            <Bullets items={i.discovers} />
          </Block>
          <Block title="Permisos que pide" aside={<span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle"><Lock className="h-3 w-3" /> solo lectura</span>}>
            <Bullets items={i.permissions} />
          </Block>
          <Block title="Antes de empezar">
            <Bullets items={i.requirements} />
          </Block>

          <div id="parametros" className="scroll-mt-24">
            <Block title="Parámetros">
              {i.availability === 'pronto' ? (
                <>
                  <ParamsPreview fields={i.params} />
                  <p className="mt-3 text-[12px] text-ink-subtle">Disponible pronto. Estos son los datos que te pediremos para conectarla.</p>
                </>
              ) : c?.status === 'demo' ? (
                <>
                  <ParamsPreview fields={i.params} demo />
                  <p className="mt-3 text-[12px] text-ink-subtle">Esta es una conexión de ejemplo para la demostración; los parámetros no se pueden editar.</p>
                </>
              ) : !canWrite ? (
                <p className="text-[12px] text-ink-subtle">Solo administración puede cambiar las conexiones.</p>
              ) : !isReady && !c ? (
                <>
                  <ParamsPreview fields={i.params} />
                  <p className="mt-3 text-[12px] text-ink-subtle">Esta integración la activa tu consultor de Ónix. Después podrás conectarla aquí.</p>
                </>
              ) : i.provider === 'microsoft' ? (
                <MicrosoftParams c={c} />
              ) : i.provider === 'aws' ? (
                <AwsParams c={c} />
              ) : null}
            </Block>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-[13px] text-ink">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function ConnectionStatus({ c, canWrite, reconnectHref }: { c: ConnectorView; canWrite: boolean; reconnectHref?: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas-subtle px-4 py-3">
      <div className="space-y-1 text-[12px] text-ink-muted">
        {c.displayName ? <p className="truncate">Cuenta: <span className="text-ink">{c.displayName}</span></p> : null}
        {c.lastSyncAt ? (
          <p>
            Última revisión: {fmt(c.lastSyncAt)}
            {c.summary.found != null ? ` · ${c.summary.found} encontrados` : ''}
            {c.summary.added ? ` · ${c.summary.added} nuevos` : ''}
          </p>
        ) : (
          <p>Todavía no se revisa.</p>
        )}
        {c.lastError ? <p className="text-danger">{c.lastError}</p> : null}
      </div>
      {canWrite && c.status !== 'demo' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={syncConnectorAction}>
            <input type="hidden" name="connectorId" value={c.id} />
            <button className="onix-btn-ghost py-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Revisar ahora
            </button>
          </form>
          {c.status === 'error' && reconnectHref ? (
            <a href={reconnectHref} className="text-[12px] text-accent hover:underline">
              Volver a conectar
            </a>
          ) : null}
          <form action={disconnectConnectorAction} className="ml-auto">
            <input type="hidden" name="connectorId" value={c.id} />
            <button className="text-[12px] text-ink-subtle hover:text-danger">Desconectar</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/** Muestra los parámetros que pide una integración, sin poder editarlos. */
function ParamsPreview({ fields, demo }: { fields: ParamField[]; demo?: boolean }) {
  return (
    <fieldset disabled className="space-y-3 opacity-80">
      {fields.map((f) =>
        f.type === 'oauth' ? (
          <div key={f.k}>
            <button type="button" className="onix-btn-ghost w-full justify-center">
              {f.label}
            </button>
          </div>
        ) : f.type === 'multi' ? (
          <div key={f.k}>
            <p className="text-[12px] text-ink-muted">{f.label}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(f.options.length ? f.options : AWS_REGIONS.slice(0, 3).map((r) => ({ k: r, n: r }))).map((o) => (
                <span key={o.k} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-ink-muted">
                  {o.n}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <label key={f.k} className="block">
            <span className="text-[12px] text-ink-muted">
              {f.label}
              {f.type === 'secret' ? <Lock className="ml-1 inline h-3 w-3" /> : null}
            </span>
            <input className="onix-input mt-1" placeholder={demo ? '(ejemplo)' : f.type === 'secret' ? '••••••••' : f.placeholder} />
          </label>
        ),
      )}
    </fieldset>
  );
}

function MicrosoftParams({ c }: { c?: ConnectorView }) {
  const selected = c?.config.sources?.length ? c.config.sources : MS_SOURCES.map((s) => s.k);
  const sourcesField = (
    <fieldset>
      <legend className="text-[12px] text-ink-muted">Qué quieres revisar</legend>
      <div className="mt-1.5 space-y-1.5">
        {MS_SOURCES.map((s) => (
          <label
            key={s.k}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-canvas-subtle"
          >
            <input type="checkbox" name="sources" value={s.k} defaultChecked={selected.includes(s.k)} className="mt-0.5 accent-[var(--onix-accent)]" />
            <span>
              <span className="block text-[13px] text-ink">{s.n}</span>
              <span className="block text-[11px] text-ink-subtle">{s.d}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  if (c && c.status !== 'pendiente') {
    return (
      <div className="space-y-4">
        <form action={saveMicrosoftSourcesAction} className="space-y-3">
          {sourcesField}
          <button className="onix-btn-ghost">Guardar</button>
        </form>
        <form action="/api/conectores/microsoft/iniciar" method="get" className="border-t border-border pt-4">
          {selected.map((s) => (
            <input key={s} type="hidden" name="sources" value={s} />
          ))}
          <p className="text-[12px] text-ink-muted">¿Cambió la cuenta o venció el permiso?</p>
          <button className="mt-2 text-[13px] text-accent hover:underline">Volver a iniciar sesión con Microsoft</button>
        </form>
      </div>
    );
  }
  return (
    <form action="/api/conectores/microsoft/iniciar" method="get" className="space-y-4">
      {sourcesField}
      <label className="block">
        <span className="text-[12px] text-ink-muted">Dominio de tu empresa (opcional)</span>
        <input name="domain" placeholder="tuempresa.com" className="onix-input mt-1" autoComplete="off" />
        <span className="mt-1 block text-[11px] text-ink-subtle">Lleva directo al inicio de sesión de tu organización.</span>
      </label>
      <button className="onix-btn-primary w-full justify-center">Iniciar sesión con Microsoft</button>
      <p className="text-[11px] leading-relaxed text-ink-subtle">
        Ónix nunca ve tu contraseña. Microsoft le da un permiso de solo lectura que puedes retirar cuando quieras desde Entra ID.
      </p>
    </form>
  );
}

function AwsParams({ c }: { c?: ConnectorView }) {
  if (!c) {
    return (
      <form action={prepareAwsAction} className="space-y-3">
        <p className="text-[12px] text-ink-muted">Al empezar, Ónix genera un identificador único (ExternalId) para tu organización y te muestra las políticas que debes pegar en IAM.</p>
        <button className="onix-btn-primary w-full justify-center">Empezar conexión con AWS</button>
      </form>
    );
  }
  return (
    <div>
      <ol className="list-decimal space-y-1 pl-4 text-[12px] text-ink-muted">
        <li>En IAM crea un rol para "Otra cuenta de AWS" y pega esta política de confianza.</li>
        <li>Agrégale la política de permisos de solo lectura.</li>
        <li>Pega aquí el ARN del rol y elige tus regiones.</li>
      </ol>
      <CopyBlock label="Política de confianza" text={trustPolicy(c.config.externalId ?? '')} />
      <CopyBlock label="Permisos de solo lectura" text={PERMISSIONS_POLICY} />
      <AwsForm regions={AWS_REGIONS} selected={c.config.regions ?? ['us-east-1']} roleArn={c.config.roleArn} />
    </div>
  );
}
