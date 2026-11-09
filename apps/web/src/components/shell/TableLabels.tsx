'use client';

import { useEffect } from 'react';

/**
 * En pantallas chicas las tablas se muestran como tarjetas (ver .onix-table en globals.css).
 * Este componente copia el nombre de cada columna a sus celdas (data-label) para que
 * cada dato conserve su etiqueta.
 */
export function TableLabels() {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>('table.onix-table').forEach((table) => {
        const heads = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '');
        if (!heads.length) return;
        table.querySelectorAll('tbody tr').forEach((tr) => {
          let col = 0;
          Array.from(tr.children).forEach((cell) => {
            const td = cell as HTMLTableCellElement;
            const text = heads[col] ?? '';
            if (td.dataset.label !== text) td.dataset.label = text;
            col += td.colSpan || 1;
          });
        });
      });
    };
    label();
    const obs = new MutationObserver(label);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
