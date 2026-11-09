import { TOOL_SUGGESTIONS } from '@onix/templates';
import { TrendChart } from '@/components/charts/TrendChart';
import { IngestKeyPanel } from '@/components/panels/IngestKeyPanel';
import { Card, Empty, Kpi, PageHeader } from '@/components/ui/PageHeader';
import { saveUsageAction } from '@/lib/actions/telemetry';
import { loadOrgOverview } from '@/lib/server/insights';
import { mxn, summarizeUsage } from '@/lib/server/telemetry';
import { requireSession } from '@/lib/session';

const pct = (n: number | null) => (n == null ? 'sin mes anterior' : `${n >= 0 ? '+' : ''}${n}% vs. mes anterior`);

export default async function TelemetriaPage() {
  const session = await requireSession();
  const o = await loadOrgOverview(session.user.organizationId);
  const canWrite = session.user.role !== 'client_reader';
  const t = summarizeUsage(o.usage);
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div>
      <PageHeader
        eyebrow="Operación"
        title="Telemetría de uso de IA"
        description="Cuánta IA se usa, en qué herramientas, cuánto cuesta y cuánto ocurre fuera de lo autorizado."
      />

      {!t.last ? (
        <Empty title="Aún no hay datos de uso">Captura el primer mes abajo o conecta tus sistemas con la clave de telemetría.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Kpi label={`Solicitudes · ${t.last.label}`} value={t.last.requests.toLocaleString('es-MX')} sub={pct(t.change.requests)} />
            <Kpi label="Usuarios activos" value={t.last.users.toLocaleString('es-MX')} sub={pct(t.change.users)} />
            <Kpi label="Costo del mes" value={mxn(t.last.cost)} sub={`MXN · ${pct(t.change.cost)}`} />
            <Kpi label="Uso no autorizado" value={`${t.shadowShare}%`} sub={`de las solicitudes · ${t.incidents6m} incidentes en 6 meses`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card title="Solicitudes por mes">
              <TrendChart
                labels={t.monthly.map((m) => m.label)}
                series={[
                  { name: 'Herramientas autorizadas', values: t.monthly.map((m) => m.sanctionedRequests), tone: 'solid' },
                  { name: 'Uso no autorizado', values: t.monthly.map((m) => m.shadowRequests), tone: 'muted' },
                ]}
              />
            </Card>
            <Card title="Costo por mes" aside={<span className="onix-chip">MXN</span>}>
              <TrendChart labels={t.monthly.map((m) => m.label)} series={[{ name: 'Costo', values: t.monthly.map((m) => m.cost), tone: 'solid' }]} kind="mxn" height={260} width={420} />
              <p className="mt-2 text-[12px] text-ink-subtle">Costo por solicitud este mes: {t.last.requests ? mxn((t.last.cost / t.last.requests) * 1000) : '$0'} por cada mil.</p>
            </Card>
          </div>

          <Card title={`Por herramienta · ${t.last.label}`} className="mt-4">
            <div className="overflow-x-auto">
              <table className="onix-table">
                <thead>
                  <tr>
                    <th>Herramienta</th>
                    <th>Estado</th>
                    <th className="text-right">Usuarios</th>
                    <th className="text-right">Solicitudes</th>
                    <th className="text-right">Cambio</th>
                    <th className="text-right">Costo MXN</th>
                    <th className="text-right">Incidentes</th>
                    <th>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {t.tools.map((r) => (
                    <tr key={r.id}>
                      <td>{r.tool}</td>
                      <td>
                        <span className={`onix-chip ${r.sanctioned ? '' : 'border-danger/40 text-danger'}`}>{r.sanctioned ? 'Autorizada' : 'No autorizada'}</span>
                      </td>
                      <td className="text-right tabular-nums">{r.activeUsers.toLocaleString('es-MX')}</td>
                      <td className="text-right tabular-nums">{r.requests.toLocaleString('es-MX')}</td>
                      <td className="text-right tabular-nums text-ink-muted">{r.change == null ? '·' : `${r.change >= 0 ? '+' : ''}${r.change}%`}</td>
                      <td className="text-right tabular-nums">{mxn(r.costMxn)}</td>
                      <td className={`text-right tabular-nums ${r.incidents ? 'text-danger' : 'text-ink-muted'}`}>{r.incidents}</td>
                      <td className="text-ink-muted">{r.source === 'api' ? 'API' : 'Manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {canWrite ? (
          <Card title="Capturar un mes">
            <form action={saveUsageAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[12px] text-ink-muted">
                  Mes
                  <input type="month" name="month" defaultValue={thisMonth} required className="onix-input mt-1" />
                </label>
                <label className="text-[12px] text-ink-muted">
                  Herramienta
                  <input name="tool" list="tel-tools" required className="onix-input mt-1" placeholder="Elegir o escribir" />
                  <datalist id="tel-tools">
                    {TOOL_SUGGESTIONS.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['activeUsers', 'Usuarios'],
                  ['requests', 'Solicitudes'],
                  ['costMxn', 'Costo MXN'],
                  ['incidents', 'Incidentes'],
                ].map(([n, l]) => (
                  <label key={n} className="text-[12px] text-ink-muted">
                    {l}
                    <input name={n} inputMode="numeric" defaultValue="0" className="onix-input mt-1 tabular-nums" />
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="sanctioned" defaultChecked className="h-4 w-4 accent-[var(--onix-accent)]" />
                Herramienta autorizada por la empresa
              </label>
              <button className="onix-btn-primary">Guardar</button>
            </form>
          </Card>
        ) : null}
        <Card title="Conectar tus sistemas">
          <IngestKeyPanel hasKey={Boolean(o.org?.ingestKeyHash)} canWrite={canWrite} />
        </Card>
      </div>
    </div>
  );
}
