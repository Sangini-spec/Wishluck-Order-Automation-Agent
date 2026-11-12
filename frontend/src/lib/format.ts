import { format, formatDistanceToNowStrict } from 'date-fns';

export type J = Record<string, unknown>;
export const rec = (v: unknown): J =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : {};
export const arr = (v: unknown): J[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as J[]) : [];
export const str = (v: unknown, f = '—') =>
  v === null || v === undefined || v === '' ? f : typeof v === 'object' ? JSON.stringify(v) : String(v);
export const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : null;
export const inr = (v: unknown) => {
  const n = num(v);
  return n === null ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};
export const human = (s: unknown) =>
  str(s).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const when = (s?: unknown) => {
  if (!s) return '—';
  const d = new Date(String(s));
  return isNaN(d.getTime()) ? String(s) : format(d, 'd MMM yyyy, HH:mm');
};
export const ago = (s?: unknown) => {
  if (!s) return '—';
  const d = new Date(String(s));
  return isNaN(d.getTime()) ? String(s) : formatDistanceToNowStrict(d, { addSuffix: true });
};
export const pct = (v: unknown) => {
  const n = num(v);
  if (n === null) return '—';
  return `${(n <= 1 ? n * 100 : n).toFixed(1)}%`;
};
export const secs = (v: unknown) => {
  const n = num(v);
  if (n === null) return '—';
  if (n < 60) return `${n.toFixed(n < 10 ? 1 : 0)}s`;
  if (n < 3600) return `${Math.floor(n / 60)}m ${Math.round(n % 60)}s`;
  return `${(n / 3600).toFixed(1)}h`;
};

export type Tone = 'indigo' | 'madder' | 'turmeric' | 'leaf' | 'stone';
export function tone(status: unknown): Tone {
  const s = str(status, '').toUpperCase();
  if (/(FAIL|CANCEL|RTO|HIGH|NEEDS_HUMAN|ERROR|REJECT|HELD|ON_HOLD|BLOCK)/.test(s)) return 'madder';
  if (/(PENDING|MEDIUM|AWAIT|REMIND|OPEN|PROCESS|OUT_FOR|NEW|UNVERIFIED|WARN)/.test(s)) return 'turmeric';
  if (/(DELIVER|CONFIRM|PAID|RESOLVED|SUCCESS|LOW|OK|COMPLETE|VERIFIED|REFUNDED)/.test(s)) return 'leaf';
  if (/(AI_|TRANSIT|SHIPPED|PICKED|HANDLING)/.test(s)) return 'indigo';
  return 'stone';
}

export function errMsg(e: unknown) {
  if (e && typeof e === 'object') {
    const d = rec((e as { data?: unknown }).data);
    if (typeof d.message === 'string') return d.message;
    if (typeof d.error === 'string') return d.error;
    if (e instanceof Error) return e.message;
  }
  return 'Something went wrong. Try again.';
}

export function hashHue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
