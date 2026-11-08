'use client';

import { useRef } from 'react';
import * as XLSX from 'xlsx';
import { importUseCasesFromRows } from '@/lib/actions/inventory';

type CaseLite = {
  name: string;
  description: string | null;
  risk: string;
  area: string | null;
  origin: string;
  status: string;
};

export function InventoryImportExport({ cases }: { cases: CaseLite[] }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function exportExcel() {
    const rows = cases.map((c) => ({
      name: c.name,
      description: c.description ?? '',
      risk: c.risk,
      area: c.area ?? '',
      origin: c.origin,
      status: c.status,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Inventario');
    XLSX.writeFile(book, 'inventario-onix.xlsx');
  }

  async function onFile(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet!);
    await importUseCasesFromRows(
      json.map((r) => ({
        name: r.name ?? r.Nombre ?? '',
        description: r.description ?? r.Descripcion ?? '',
        risk: r.risk ?? r.Riesgo ?? 'Medio',
        area: r.area ?? r.Area ?? '',
        origin: r.origin ?? 'import',
        status: r.status ?? 'Propuesto',
      })),
    );
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="onix-btn-ghost" onClick={exportExcel}>
        Exportar Excel
      </button>
      <button type="button" className="onix-btn-ghost" onClick={() => inputRef.current?.click()}>
        Importar Excel
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
    </div>
  );
}
