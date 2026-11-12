import { useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { human, tone, type Tone, errMsg, hashHue } from '@/lib/format';

const toneCls: Record<Tone, string> = {
  indigo: 'bg-indigo/10 text-indigo border-indigo/20',
  madder: 'bg-madder/10 text-madder border-madder/25',
  turmeric: 'bg-turmeric/15 text-[hsl(32_80%_30%)] border-turmeric/40',
  leaf: 'bg-leaf/10 text-leaf border-leaf/25',
  stone: 'bg-muted text-muted-foreground border-border',
};

export function Pill({ value, t, className, testId }: { value: unknown; t?: Tone; className?: string; testId?: string }) {
  const tn = t ?? tone(value);
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        toneCls[tn],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', {
        'bg-indigo': tn === 'indigo', 'bg-madder': tn === 'madder', 'bg-turmeric': tn === 'turmeric',
        'bg-leaf': tn === 'leaf', 'bg-muted-foreground/50': tn === 'stone',
      })} />
      {human(value)}
    </span>
  );
}

export function PageHeader({ kicker, title, children, sub }: { kicker: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="rise mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="font-data text-[11px] uppercase tracking-[0.2em] text-madder">{kicker}</div>
        <h1 className="font-display mt-1 text-3xl font-semibold md:text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn('rounded-xl border bg-card shadow-[0_1px_0_hsl(36_22%_84%),0_10px_30px_-18px_hsl(232_58%_20%/0.25)]', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          {action}
        </div>
      )}
      <div className={cn('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Metric({ label, value, hint, accent, testId }: { label: string; value: ReactNode; hint?: ReactNode; accent?: Tone; testId?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className={cn('absolute inset-y-0 left-0 w-1', {
        'bg-indigo': !accent || accent === 'indigo', 'bg-madder': accent === 'madder', 'bg-turmeric': accent === 'turmeric',
        'bg-leaf': accent === 'leaf', 'bg-border': accent === 'stone',
      })} />
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div data-testid={testId} className="font-display mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-indigo/30 bg-accent text-indigo">
        <div className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-turmeric" />
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-madder/25 bg-madder/5 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-madder" />
      <div className="font-display text-lg font-semibold">This ledger would not open</div>
      <p className="max-w-md text-sm text-muted-foreground">{errMsg(error)}</p>
      {retry && (
        <button data-testid="button-retry" onClick={retry} className="mt-1 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent">
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function Rows({ n = 6, h = 'h-12' }: { n?: number; h?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-lg bg-muted', h)} style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn('text-right font-medium', mono && 'font-data text-[13px]')}>{v}</span>
    </div>
  );
}

export function JsonBlock({ value, label = 'Payload', defaultOpen = false }: { value: unknown; label?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (value === undefined || value === null) return null;
  return (
    <div className="rounded-lg border bg-secondary/40">
      <button data-testid="button-toggle-json" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <pre className="font-data max-h-72 overflow-auto border-t px-3 py-2 text-[11.5px] leading-relaxed text-foreground/85">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** Generative block-print motif for products — no photography required. */
export function Motif({ seed, className, label }: { seed: string; className?: string; label?: string }) {
  const h = hashHue(seed);
  const palettes = [
    ['232 58% 30%', '40 88% 56%', '40 40% 94%'],
    ['356 64% 44%', '40 40% 94%', '232 58% 22%'],
    ['168 42% 30%', '40 88% 60%', '40 40% 94%'],
    ['40 85% 52%', '356 64% 40%', '40 40% 95%'],
  ];
  const [a, b, c] = palettes[h % palettes.length];
  const shape = h % 3;
  const id = `m${seed.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label={label ?? seed}>
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`rotate(${h % 45})`}>
          <rect width="40" height="40" fill={`hsl(${a})`} />
          {shape === 0 && <><circle cx="20" cy="20" r="9" fill="none" stroke={`hsl(${b})`} strokeWidth="2" /><circle cx="20" cy="20" r="3" fill={`hsl(${c})`} /><circle cx="0" cy="0" r="3" fill={`hsl(${b})`} /></>}
          {shape === 1 && <><path d="M20 4 L36 20 L20 36 L4 20Z" fill="none" stroke={`hsl(${b})`} strokeWidth="2" /><circle cx="20" cy="20" r="2.5" fill={`hsl(${c})`} /></>}
          {shape === 2 && <><path d="M20 6c6 6 6 22 0 28c-6-6-6-22 0-28z" fill={`hsl(${b})`} opacity=".85" /><path d="M6 20c6-6 22-6 28 0c-6 6-22 6-28 0z" fill={`hsl(${c})`} opacity=".7" /></>}
        </pattern>
      </defs>
      <rect width="200" height="240" fill={`hsl(${c})`} />
      <path d="M62 34 L82 24 Q100 36 118 24 L138 34 L168 62 L150 86 L138 76 L138 210 L62 210 L62 76 L50 86 L32 62 Z" fill={`url(#${id})`} stroke={`hsl(${a})`} strokeWidth="2" strokeLinejoin="round" />
      <path d="M82 24 Q100 44 118 24" fill="none" stroke={`hsl(${b})`} strokeWidth="3" />
    </svg>
  );
}
