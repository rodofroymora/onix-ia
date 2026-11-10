/**
 * Catálogo de apps de IA de terceros que se reconocen en el directorio del cliente (Entra ID).
 * Se compara por nombre de la app o del publicador; no depende de identificadores que cambian.
 */
export interface AiAppMatch {
  vendor: string;
  product: string;
  platform: 'openai' | 'claude' | 'gemini_ent' | 'saas_ia';
  category: string;
}

const CATALOG: { re: RegExp; m: AiAppMatch }[] = [
  { re: /\bchatgpt\b|\bopenai\b/i, m: { vendor: 'OpenAI', product: 'ChatGPT', platform: 'openai', category: 'Asistente general' } },
  { re: /\banthropic\b|\bclaude\b/i, m: { vendor: 'Anthropic', product: 'Claude', platform: 'claude', category: 'Asistente general' } },
  { re: /\bgemini\b|google ai studio|\bnotebooklm\b/i, m: { vendor: 'Google', product: 'Gemini', platform: 'gemini_ent', category: 'Asistente general' } },
  { re: /\bperplexity\b/i, m: { vendor: 'Perplexity', product: 'Perplexity', platform: 'saas_ia', category: 'Búsqueda con IA' } },
  { re: /\bmistral\b|\ble chat\b/i, m: { vendor: 'Mistral AI', product: 'Le Chat', platform: 'saas_ia', category: 'Asistente general' } },
  { re: /\bdeepseek\b/i, m: { vendor: 'DeepSeek', product: 'DeepSeek', platform: 'saas_ia', category: 'Asistente general' } },
  { re: /\bgrok\b|\bx\.ai\b|\bxai\b/i, m: { vendor: 'xAI', product: 'Grok', platform: 'saas_ia', category: 'Asistente general' } },
  { re: /\botter(\.ai)?\b/i, m: { vendor: 'Otter.ai', product: 'Otter', platform: 'saas_ia', category: 'Notas de reuniones' } },
  { re: /\bfireflies\b/i, m: { vendor: 'Fireflies.ai', product: 'Fireflies', platform: 'saas_ia', category: 'Notas de reuniones' } },
  { re: /\bread\.ai\b|\bread ai\b/i, m: { vendor: 'Read AI', product: 'Read AI', platform: 'saas_ia', category: 'Notas de reuniones' } },
  { re: /\bfathom\b/i, m: { vendor: 'Fathom', product: 'Fathom', platform: 'saas_ia', category: 'Notas de reuniones' } },
  { re: /\btl;?dv\b/i, m: { vendor: 'tl;dv', product: 'tl;dv', platform: 'saas_ia', category: 'Notas de reuniones' } },
  { re: /\bgrammarly\b/i, m: { vendor: 'Grammarly', product: 'Grammarly', platform: 'saas_ia', category: 'Redacción' } },
  { re: /\bjasper\b/i, m: { vendor: 'Jasper', product: 'Jasper', platform: 'saas_ia', category: 'Redacción' } },
  { re: /\bcopy\.ai\b/i, m: { vendor: 'Copy.ai', product: 'Copy.ai', platform: 'saas_ia', category: 'Redacción' } },
  { re: /\bwritesonic\b/i, m: { vendor: 'Writesonic', product: 'Writesonic', platform: 'saas_ia', category: 'Redacción' } },
  { re: /\bdeepl\b/i, m: { vendor: 'DeepL', product: 'DeepL', platform: 'saas_ia', category: 'Traducción' } },
  { re: /\bgamma\b/i, m: { vendor: 'Gamma', product: 'Gamma', platform: 'saas_ia', category: 'Presentaciones' } },
  { re: /\bbeautiful\.ai\b/i, m: { vendor: 'Beautiful.ai', product: 'Beautiful.ai', platform: 'saas_ia', category: 'Presentaciones' } },
  { re: /\bcursor\b/i, m: { vendor: 'Anysphere', product: 'Cursor', platform: 'saas_ia', category: 'Código' } },
  { re: /\breplit\b/i, m: { vendor: 'Replit', product: 'Replit', platform: 'saas_ia', category: 'Código' } },
  { re: /\bloveable\b|\blovable\b/i, m: { vendor: 'Lovable', product: 'Lovable', platform: 'saas_ia', category: 'Código' } },
  { re: /\belevenlabs\b/i, m: { vendor: 'ElevenLabs', product: 'ElevenLabs', platform: 'saas_ia', category: 'Voz' } },
  { re: /\bsynthesia\b/i, m: { vendor: 'Synthesia', product: 'Synthesia', platform: 'saas_ia', category: 'Video' } },
  { re: /\bheygen\b/i, m: { vendor: 'HeyGen', product: 'HeyGen', platform: 'saas_ia', category: 'Video' } },
  { re: /\bglean\b/i, m: { vendor: 'Glean', product: 'Glean', platform: 'saas_ia', category: 'Búsqueda con IA' } },
  { re: /\bharvey\b/i, m: { vendor: 'Harvey', product: 'Harvey', platform: 'saas_ia', category: 'Jurídico' } },
  { re: /\bpoe\b/i, m: { vendor: 'Quora', product: 'Poe', platform: 'saas_ia', category: 'Asistente general' } },
  { re: /\bcharacter\.ai\b/i, m: { vendor: 'Character.AI', product: 'Character.AI', platform: 'saas_ia', category: 'Asistente general' } },
  { re: /\bhugging ?face\b/i, m: { vendor: 'Hugging Face', product: 'Hugging Face', platform: 'saas_ia', category: 'Modelos' } },
  { re: /\bcohere\b/i, m: { vendor: 'Cohere', product: 'Cohere', platform: 'saas_ia', category: 'Modelos' } },
  { re: /\bchatpdf\b|\bhumata\b/i, m: { vendor: 'Varios', product: 'Lectura de PDF con IA', platform: 'saas_ia', category: 'Documentos' } },
];

export function matchAiApp(...names: (string | null | undefined)[]): AiAppMatch | null {
  const text = names.filter(Boolean).join(' · ');
  if (!text) return null;
  for (const c of CATALOG) if (c.re.test(text)) return c.m;
  return null;
}

/** Permisos de Microsoft Graph que dejan a una app leer información sensible. */
const SENSITIVE = [/^Mail\./i, /^Files\./i, /^Sites\./i, /^Calendars\./i, /^Chat\./i, /^ChannelMessage\./i, /^Notes\./i, /^Contacts\./i, /^Directory\./i, /^User\.Read\.All$/i, /^OnlineMeeting/i];
const WRITE = /\.(ReadWrite|Send|Write)/i;

/** Riesgo sugerido de una app según los permisos que le dieron. El equipo lo valida. */
export function riskFromScopes(scopes: string[], orgWide: boolean): 'Bajo' | 'Medio' | 'Alto' {
  const sensitive = scopes.filter((s) => SENSITIVE.some((r) => r.test(s)));
  if (sensitive.some((s) => WRITE.test(s)) || (orgWide && sensitive.length)) return 'Alto';
  if (sensitive.length) return 'Medio';
  return 'Bajo';
}

/** Permisos básicos de inicio de sesión: no dicen nada del riesgo. */
const BASIC_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access', 'user.read', 'user.readbasic.all']);

const SCOPE_LABELS: [RegExp, string][] = [
  [/^Mail\.Send/i, 'Enviar correo'],
  [/^Mail\.ReadWrite/i, 'Modificar correo'],
  [/^Mail\.Read/i, 'Leer correo'],
  [/^Calendars\.ReadWrite/i, 'Modificar calendario'],
  [/^Calendars\.Read/i, 'Leer calendario'],
  [/^Files\.ReadWrite/i, 'Modificar archivos'],
  [/^Files\.Read/i, 'Leer archivos'],
  [/^Sites\.(ReadWrite|Manage|FullControl)/i, 'Modificar SharePoint'],
  [/^Sites\.Read/i, 'Leer SharePoint'],
  [/^OnlineMeeting/i, 'Leer reuniones de Teams'],
  [/^(Chat|ChannelMessage)\.(ReadWrite|Send)/i, 'Escribir en chats de Teams'],
  [/^(Chat|ChannelMessage)\./i, 'Leer chats de Teams'],
  [/^Contacts\./i, 'Leer contactos'],
  [/^Notes\./i, 'Leer OneNote'],
  [/^(Directory\.|User\.Read\.All|Group\.Read)/i, 'Leer el directorio'],
  [/^Tasks\./i, 'Tareas'],
];

/** Permisos relevantes en español, del más sensible al menos; sin los básicos de inicio de sesión. */
export function describeScopes(scopes: string[]): string[] {
  const out: string[] = [];
  for (const s of scopes) {
    if (BASIC_SCOPES.has(s.toLowerCase())) continue;
    const label = SCOPE_LABELS.find(([re]) => re.test(s))?.[1] ?? s;
    if (!out.includes(label)) out.push(label);
  }
  const rank = (l: string) => (/Modificar|Enviar|Escribir/.test(l) ? 0 : /Leer/.test(l) ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}
