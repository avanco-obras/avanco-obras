/**
 * Cores por grupo/disciplina da atividade (spec Linha de Balanço).
 * O grupo é classificado por palavras-chave no nome do ActivityType (ou da
 * atividade); grupos não mapeados recebem cor determinística de uma paleta
 * estendida (hash do nome). O tom claro é derivado do escuro (mistura com
 * branco) para manter a identidade de dois tons.
 */

export interface GroupColor {
  key: string;   // slug do grupo (p/ legenda)
  label: string; // rótulo exibido na legenda
  dark: string;  // executado
  light: string; // restante
}

const KEYWORD_GROUPS: { key: string; label: string; pattern: RegExp; dark: string }[] = [
  { key: 'estrutura', label: 'Estrutura', dark: '#64748b', pattern: /estrutur|concret|laje|pilar|viga|funda[çc][ãa]o|estaca|coroament|forma|armadur/i },
  { key: 'alvenaria', label: 'Alvenaria', dark: '#ea580c', pattern: /alvenaria|veda[çc]|eleva[çc][ãa]o de parede/i },
  { key: 'eletrica', label: 'Elétrica', dark: '#2563eb', pattern: /el[ée]tric|eletrodut|cabeament|spda|tomada|ilumina[çc]/i },
  { key: 'hidraulica', label: 'Hidráulica', dark: '#059669', pattern: /hidr[áa]ulic|hidrossanit|[áa]gua|esgoto|lou[çc]a|tubula[çc]|prumada|inc[êe]ndio|g[áa]s/i },
  { key: 'impermeabilizacao', label: 'Impermeabilização', dark: '#9333ea', pattern: /impermeabiliza/i },
  { key: 'acabamento', label: 'Acabamento', dark: '#b08968', pattern: /acabament|revestiment|cer[âa]mic|porcelanato|gesso|forro|contrapiso|reboco|emboço|azulejo|piso/i },
  { key: 'pintura', label: 'Pintura', dark: '#ca8a04', pattern: /pintura|textura|massa corrida|selador/i },
  { key: 'esquadrias', label: 'Esquadrias', dark: '#8b5a2b', pattern: /esquadria|janela|porta|vidro|caixilho|batente/i },
];

/** Paleta estendida p/ grupos não mapeados (tons médios, distinguíveis). */
const EXTENDED_PALETTE = [
  '#0891b2', '#dc2626', '#7c3aed', '#db2777', '#65a30d',
  '#0d9488', '#e11d48', '#6d28d9', '#c2410c', '#4d7c0f',
];

/** Mistura a cor com branco (t em [0,1]; t=0.72 ≈ tom "restante"). */
export function lighten(hex: string, t = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const cache = new Map<string, GroupColor>();

/** Resolve a cor do grupo a partir do nome do ActivityType (ou da atividade). */
export function groupColor(groupName: string | undefined): GroupColor {
  const name = (groupName ?? '').trim() || 'Outros';
  const cached = cache.get(name);
  if (cached) return cached;

  let result: GroupColor | null = null;
  for (const g of KEYWORD_GROUPS) {
    if (g.pattern.test(name)) {
      result = { key: g.key, label: g.label, dark: g.dark, light: lighten(g.dark) };
      break;
    }
  }
  if (!result) {
    const dark = EXTENDED_PALETTE[hashCode(name.toLowerCase()) % EXTENDED_PALETTE.length];
    result = { key: `outros-${hashCode(name.toLowerCase()) % EXTENDED_PALETTE.length}`, label: name, dark, light: lighten(dark) };
  }
  cache.set(name, result);
  return result;
}
