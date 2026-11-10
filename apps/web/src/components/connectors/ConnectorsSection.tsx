import Link from 'next/link';
import { Cloud, RefreshCw } from 'lucide-react';
import { AWS_REGIONS, PERMISSIONS_POLICY, trustPolicy } from '@/lib/connectors/aws';
import { PROVIDERS, type ProviderKey } from '@/lib/connectors/types';
import { disconnectConnectorAction, prepareAwsAction, syncConnectorAction } from '@/lib/actions/connectors';
import type { ConnectorView } from '@/lib/server/connectors';
import { AwsForm, CopyBlock } from './AwsForm';

const STATUS: Record<string, { n: string; cls: string }> = {
  conectado: { n: 'Conectado', cls: 'onix-tint-success' },
  error: { n: 'Con error', cls: 'onix-tint-danger' },
  pendiente: { n: 'Por terminar', cls: 'onix-tint-warning' },
  demo: { n: 'Demostración', cls: 'onix-tint-accent' },
};

const ERRORS: Record<string, string> = {
  config: 'El conector de Microsoft aún no está configurado en Ónix.',
  cancelado: 'Se canceló el inicio de sesión en Microsoft.',
  estado: 'La conexión expiró o no coincide con tu sesión. Inténtalo de nuevo.',
  llave: 'Falta la llave de cifrado de Ónix (CONNECTOR_ENC_KEY).',
  consentimiento: 'Falta el consentimiento de un administrador de Microsoft 365.',
  microsoft: 'Microsoft no completó la conexión. Inténtalo de nuevo.',
  sync: 'La conexión quedó, pero la búsqueda tuvo errores. Revisa el detalle en la tarjeta.',
};

const fmt = (d: Date | null) => (d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

export function ConnectorsSection({
  list,
  ready,
  canWrite,
  flash,
}: {
  list: ConnectorView[];
  ready: Record<ProviderKey, boolean>;
  canWrite: boolean;
  flash: { conector?: string; ok?: string; nuevos?: string; error?: string };
}) {
  const by = (k: string) => list.find((c) => c.provider === k);
  return (
    <section id="conectores" className="mt-6 scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-tight text-ink">Conectores de descubrimiento</h2>
          <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
            Ónix lee, con permisos de solo lectura, qué apps de IA y agentes existen en tu nube. Lo que encuentra aparece en Agent Discovery para que decidas
            qué registrar. Se revisa cada día.
          </p>
        </div>
        <Link href="/agentes?tab=detectados" className="text-[13px] text-accent hover:underline">
          Ver detectados
        </Link>
      </div>

      {flash.conector && (flash.ok || flash.error) ? (
        <p className={`mb-3 rounded-lg px-3 py-2 text-[13px] ${flash.ok ? 'onix-tint-success' : 'onix-tint-danger'}`}>
          {flash.ok ? `Listo. ${Number(flash.nuevos) ? `${flash.nuevos} detecciones nuevas en Agent Discovery.` : 'Sin detecciones nuevas.'}` : ERRORS[flash.error ?? ''] ?? 'No se pudo completar.'}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(PROVIDERS) as ProviderKey[]).map((k) => {
          const c = by(k);
          const st = c ? STATUS[c.status] ?? STATUS.pendiente! : null;
          return (
            <div key={k} className="onix-panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-canvas-subtle text-ink-muted">
                    <Cloud className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <p className="text-[14px] font-medium leading-tight text-ink">{PROVIDERS[k].n}</p>
                </div>
                {st ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.n}</span> : null}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{PROVIDERS[k].d}</p>

              {c && c.status !== 'pendiente' ? (
                <div className="mt-3 space-y-1 text-[12px] text-ink-muted">
                  {c.displayName ? <p className="truncate">Cuenta: {c.displayName}</p> : null}
                  {c.lastSyncAt ? (
                    <p>
                      Última revisión: {fmt(c.lastSyncAt)}
                      {c.summary.found != null ? ` · ${c.summary.found} encontrados` : ''}
                    </p>
                  ) : null}
                  {c.lastError ? <p className="text-danger">{c.lastError}</p> : null}
                </div>
              ) : null}

              <div className="mt-auto pt-4">
                {k === 'google' ? (
                  <span className="text-[12px] text-ink-subtle">Disponible pronto.</span>
                ) : !canWrite ? null : k === 'microsoft' ? (
                  c ? (
                    <ConnectedActions c={c} reconnectHref="/api/conectores/microsoft/iniciar" />
                  ) : ready.microsoft ? (
                    <a href="/api/conectores/microsoft/iniciar" className="onix-btn-primary w-full justify-center">
                      Conectar Microsoft 365
                    </a>
                  ) : (
                    <span className="text-[12px] text-ink-subtle">Lo activa tu consultor de Ónix.</span>
                  )
                ) : !ready.aws && !c ? (
                  <span className="text-[12px] text-ink-subtle">Lo activa tu consultor de Ónix.</span>
                ) : !c ? (
                  <form action={prepareAwsAction}>
                    <button className="onix-btn-primary w-full justify-center">Conectar AWS</button>
                  </form>
                ) : c.status === 'pendiente' || flash.conector === 'aws' ? (
                  <details open={c.status === 'pendiente'} className="group">
                    <summary className="cursor-pointer text-[13px] text-accent">{c.status === 'pendiente' ? 'Pasos para conectar' : 'Cambiar rol o regiones'}</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-ink-muted">
                      <li>En IAM crea un rol para "Otra cuenta de AWS" y pega esta política de confianza.</li>
                      <li>Agrégale la política de permisos de solo lectura.</li>
                      <li>Copia el ARN del rol aquí abajo.</li>
                    </ol>
                    <CopyBlock label="Política de confianza" text={trustPolicy(c.config.externalId ?? '')} />
                    <CopyBlock label="Permisos de solo lectura" text={PERMISSIONS_POLICY} />
                    <AwsForm regions={AWS_REGIONS} selected={c.config.regions ?? ['us-east-1']} roleArn={c.config.roleArn} />
                  </details>
                ) : (
                  <ConnectedActions c={c} reconnectHref="/organizacion?conector=aws#conectores" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ConnectedActions({ c, reconnectHref }: { c: ConnectorView; reconnectHref: string }) {
  if (c.status === 'demo') return <p className="text-[12px] text-ink-subtle">Datos de ejemplo para la demostración.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={syncConnectorAction}>
        <input type="hidden" name="connectorId" value={c.id} />
        <button className="onix-btn-ghost">
          <RefreshCw className="h-3.5 w-3.5" /> Revisar ahora
        </button>
      </form>
      {c.status === 'error' ? (
        <a href={reconnectHref} className="text-[12px] text-accent hover:underline">
          Volver a conectar
        </a>
      ) : null}
      <form action={disconnectConnectorAction} className="ml-auto">
        <input type="hidden" name="connectorId" value={c.id} />
        <button className="text-[12px] text-ink-subtle hover:text-danger">Desconectar</button>
      </form>
    </div>
  );
}

