'use client';

import { AI_TYPES, BUSINESS_AREAS, STRATEGIC_OBJECTIVES, VALUE_TYPES, catalogName } from '@onix/templates';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { Download, Upload } from 'lucide-react';
import { importUseCasesFromRows, type ImportRow } from '@/lib/actions/inventory';

type CaseLite = {
  name: string;
  description: string | null;
  risk: string;
  area: string | null;
  status: string;
  ownerName: string | null;
  technology: string | null;
  vendor: string | null;
  usesPersonalData: boolean;
  decidesOnPeople: boolean;
  customerFacing: boolean;
  valueScore: number | null;
  strategicObjective: string | null;
  effort: number | null;
  aiType?: string | null;
  valueType?: string | null;
};

const HEADERS = [
  'Nombre', 'Descripción', 'Área', 'Dueño', 'Tecnología', 'Proveedor', 'Riesgo',
  'Usa datos personales (sí/no)', 'Decide sobre personas (sí/no)', 'De cara al cliente (sí/no)',
  'Valor estimado (1 a 5)', 'Objetivo estratégico', 'Esfuerzo (1 a 5)', 'Estatus', 'Tipo de IA', 'Tipo de valor',
];

const yes = (v: unknown) => /^(s[ií]|si|yes|true|1|x)$/i.test(String(v ?? '').trim());
const get = (r: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== '') return r[k];
  return undefined;
};

function toRow(r: Record<string, unknown>): ImportRow {
  return {
    name: String(get(r, 'Nombre', 'name') ?? ''),
    description: String(get(r, 'Descripción', 'Descripcion', 'description') ?? ''),
    area: String(get(r, 'Área', 'Area', 'area') ?? ''),
    ownerName: String(get(r, 'Dueño', 'Dueno', 'owner') ?? ''),
    technology: String(get(r, 'Tecnología', 'Tecnologia', 'technology') ?? ''),
    vendor: String(get(r, 'Proveedor', 'vendor') ?? ''),
    risk: String(get(r, 'Riesgo', 'risk') ?? 'Medio'),
    usesPersonalData: yes(get(r, 'Usa datos personales (sí/no)', 'Usa datos personales')),
    decidesOnPeople: yes(get(r, 'Decide sobre personas (sí/no)', 'Decide sobre personas')),
    customerFacing: yes(get(r, 'De cara al cliente (sí/no)', 'De cara al cliente')),
    valueScore: Number(get(r, 'Valor estimado (1 a 5)', 'Valor')) || null,
    strategicObjective: String(get(r, 'Objetivo estratégico', 'Objetivo') ?? ''),
    effort: Number(get(r, 'Esfuerzo (1 a 5)', 'Esfuerzo')) || null,
    aiType: String(get(r, 'Tipo de IA', 'aiType') ?? ''),
    valueType: String(get(r, 'Tipo de valor', 'valueType') ?? ''),
  };
}

export function InventoryImportExport({ cases }: { cases: CaseLite[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function download(rows: Record<string, unknown>[], file: string) {
    const sheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Inventario');
    // Hoja de referencia con las listas estándar para que todos clasifiquen igual.
    const n = Math.max(AI_TYPES.length, VALUE_TYPES.length, STRATEGIC_OBJECTIVES.length, BUSINESS_AREAS.length);
    const lists = Array.from({ length: n }, (_, i) => ({
      'Tipo de IA': AI_TYPES[i]?.n ?? '',
      'Tipo de valor': VALUE_TYPES[i]?.n ?? '',
      'Objetivo estratégico': STRATEGIC_OBJECTIVES[i]?.n ?? '',
      'Área': BUSINESS_AREAS[i] ?? '',
      Riesgo: ['Bajo', 'Medio', 'Alto', 'Inaceptable'][i] ?? '',
    }));
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lists), 'Listas');
    XLSX.writeFile(book, file);
  }

  function exportExcel() {
    download(
      cases.map((c) => ({
        Nombre: c.name,
        'Descripción': c.description ?? '',
        'Área': c.area ?? '',
        'Dueño': c.ownerName ?? '',
        'Tecnología': c.technology ?? '',
        Proveedor: c.vendor ?? '',
        Riesgo: c.risk,
        'Usa datos personales (sí/no)': c.usesPersonalData ? 'sí' : 'no',
        'Decide sobre personas (sí/no)': c.decidesOnPeople ? 'sí' : 'no',
        'De cara al cliente (sí/no)': c.customerFacing ? 'sí' : 'no',
        'Valor estimado (1 a 5)': c.valueScore ?? '',
        'Objetivo estratégico': c.strategicObjective ?? '',
        'Esfuerzo (1 a 5)': c.effort ?? '',
        Estatus: c.status,
        'Tipo de IA': catalogName(AI_TYPES, c.aiType) ?? '',
        'Tipo de valor': catalogName(VALUE_TYPES, c.valueType) ?? '',
      })),
      'inventario-ia.xlsx',
    );
  }

  async function onFile(file: File) {
    setMsg(null);
    const wb = XLSX.read(await file.arrayBuffer());
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!).map(toRow).filter((r) => r.name.trim());
    setPreview(rows);
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    const res = await importUseCasesFromRows(preview);
    setBusy(false);
    setPreview(null);
    setMsg(`${res.created} casos importados como Propuestos${res.skipped ? `, ${res.skipped} omitidos por duplicados` : ''}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="onix-btn-ghost" onClick={() => download([], 'plantilla-inventario-ia.xlsx')}>
          <Download className="h-3.5 w-3.5" strokeWidth={1.6} /> Plantilla
        </button>
        <button type="button" className="onix-btn-ghost" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" strokeWidth={1.6} /> Importar
        </button>
        <button type="button" className="onix-btn-ghost" onClick={exportExcel}>
          Exportar
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
      {msg ? <p className="text-[12px] text-ink-muted">{msg}</p> : null}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-5 shadow-md">
            <p className="text-[15px] font-semibold text-ink">Vista previa de la importación</p>
            <p className="mt-1 text-[13px] text-ink-muted">{preview.length} filas. Entran como Propuestos; los nombres repetidos se omiten.</p>
            <div className="mt-4 max-h-72 overflow-auto rounded-md border border-border">
              <table className="onix-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Área</th>
                    <th>Dueño</th>
                    <th>Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="text-ink-muted">{r.area}</td>
                      <td className="text-ink-muted">{r.ownerName}</td>
                      <td className="text-ink-muted">{r.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="onix-btn-ghost" onClick={() => setPreview(null)}>
                Cancelar
              </button>
              <button type="button" className="onix-btn-primary" disabled={busy} onClick={confirm}>
                {busy ? 'Importando…' : `Importar ${preview.length}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
