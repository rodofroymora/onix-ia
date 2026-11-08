import { Fragment } from 'react';

/** **negritas** → <strong>; quita restos de markdown (#, `, __). */
function inline(text: string, key: string) {
  const clean = text.replace(/`([^`]+)`/g, '$1').replace(/__([^_]+)__/g, '$1');
  const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={`${key}-${i}`} className="font-semibold text-ink">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{p.replace(/\*/g, '')}</Fragment>
    ),
  );
}

type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'list'; ordered: boolean; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^([-*•·]|\d+[.)])\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet) {
      const ordered = /^\d/.test(bullet[1]!);
      const last = blocks.at(-1);
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(bullet[2]!);
      else blocks.push({ kind: 'list', ordered, items: [bullet[2]!] });
    } else if (heading) {
      blocks.push({ kind: 'h', text: heading[1]!.replace(/\*\*/g, '') });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
}

/** Separa "**Título:** texto" o "Título: texto" en píldora + cuerpo. */
function splitTitle(item: string): { title: string | null; body: string } {
  const bold = /^\*\*([^*]{2,60}?)\*\*[:.\s-]*\s*(.*)$/.exec(item);
  if (bold) return { title: bold[1]!.replace(/[:.]$/, ''), body: bold[2]! };
  const colon = /^([^:]{3,42}):\s+(.+)$/.exec(item);
  if (colon && !/[.,]/.test(colon[1]!) && colon[1]!.trim().split(/\s+/).length <= 4) return { title: colon[1]!, body: colon[2]! };
  return { title: null, body: item };
}

/**
 * Texto redactado por la IA con formato: párrafos limpios y cada punto en una tarjeta
 * morada translúcida, con su título en píldora cuando lo trae.
 */
export function AiText({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks = parse(text);
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {blocks.map((b, i) => {
        if (b.kind === 'p')
          return (
            <p key={i} className="text-[13.5px] leading-relaxed text-ink">
              {inline(b.text, `p${i}`)}
            </p>
          );
        if (b.kind === 'h')
          return (
            <p key={i} className="onix-label pt-1">
              {b.text}
            </p>
          );
        return (
          <ul key={i} className="space-y-2">
            {b.items.map((item, j) => {
              const { title, body } = splitTitle(item);
              return (
                <li key={j} className="onix-glass flex gap-3 rounded-xl px-3.5 py-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold tabular-nums text-[var(--onix-accent-contrast)]">
                    {b.ordered ? j + 1 : '•'}
                  </span>
                  <div className="min-w-0 text-[13px] leading-relaxed text-ink">
                    {title ? <span className="onix-pill mb-1 mr-1.5 inline-block">{title}</span> : null}
                    <span className={title ? 'block' : ''}>{inline(body, `l${i}-${j}`)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        );
      })}
    </div>
  );
}
