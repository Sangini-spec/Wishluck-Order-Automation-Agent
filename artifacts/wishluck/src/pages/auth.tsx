import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Headset, ShoppingBag, Check, Loader2 } from 'lucide-react';
import {
  useDemoLogin, useLogin, useRegister, getGetSessionQueryKey, type SessionInfo,
} from '@workspace/api-client-react';
import { useSession, Wordmark } from '@/components/shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

type Role = 'CUSTOMER' | 'TEAM';
const IDENTITIES = [
  { id: 'CUST-1006', note: 'Default · order WL10239' },
  { id: 'CUST-1001', note: 'Fictional identity' },
  { id: 'CUST-1003', note: 'Fictional identity' },
  { id: 'CUST-1013', note: 'Fictional identity' },
  { id: 'CUST-1014', note: 'Fictional identity' },
  { id: 'CUST-1017', note: 'Fictional identity' },
];

const LEDGER = [
  ['WL10236', '₹4,600 COD scenario', 'explore in Ops'],
  ['Courier', 'Trigger a failed delivery', 'demo control'],
  ['Risk', 'Understand COD risk', 'reasons shown'],
  ['Chat', 'Verify order ID + phone', 'then fetch'],
  ['Handover', 'Ask for a support person', 'ticket created'],
];

export default function AuthPage() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [role, setRole] = useState<Role>('TEAM');
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [ident, setIdent] = useState('CUST-1006');
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  useEffect(() => {
    if (session?.authenticated) nav(session.user?.role === 'TEAM' ? '/ops' : '/store');
  }, [session, nav]);

  const done = (s: SessionInfo) => {
    qc.setQueryData(getGetSessionQueryKey(), s);
    nav(s.user?.role === 'TEAM' ? '/ops' : '/store');
  };
  const fail = (e: unknown) => toast({ title: 'Could not sign in', description: errMsg(e), variant: 'destructive' });
  const demo = useDemoLogin({ mutation: { onSuccess: done, onError: fail } });
  const login = useLogin({ mutation: { onSuccess: done, onError: fail } });
  const reg = useRegister({ mutation: { onSuccess: done, onError: fail } });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'login') login.mutate({ data: { email: form.email, password: form.password, role } });
    else reg.mutate({ data: { ...form, role } });
  };
  const busy = login.isPending || reg.isPending;

  return (
    <div className="grain min-h-[100dvh] bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left: the brand plate */}
      <section className="block-print relative flex flex-col justify-between overflow-hidden bg-indigo px-6 py-8 text-paper md:px-12 md:py-12">
        <svg className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] opacity-[0.13]" viewBox="0 0 200 200">
          {Array.from({ length: 12 }).map((_, i) => (
            <ellipse key={i} cx="100" cy="100" rx="90" ry="22" fill="none" stroke="hsl(40 88% 60%)" strokeWidth="1" transform={`rotate(${i * 15} 100 100)`} />
          ))}
          <circle cx="100" cy="100" r="14" fill="hsl(356 64% 50%)" />
        </svg>
        <Wordmark light />
        <div className="relative my-14 rise">
          <div className="font-data text-[11px] uppercase tracking-[0.25em] text-turmeric">Order support, Jaipur to Jorhat</div>
          <h1 className="font-display mt-4 text-5xl font-semibold leading-[0.95] md:text-7xl">
            Every order,<br /><em className="font-normal text-turmeric">accounted</em> for.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-paper/75">
            WishLuck's operations desk. Watch an AI agent verify customers, read courier trails and weigh COD risk — then
            step in, take over, and see every tool call it made along the way.
          </p>
        </div>
        <div className="relative rounded-xl border border-paper/15 bg-paper/[0.04] p-4 backdrop-blur-sm">
          <div className="mb-2 font-data text-[10px] uppercase tracking-[0.2em] text-paper/50">Scenarios to try in demo mode</div>
          <ul className="divide-y divide-paper/10">
            {LEDGER.map(([a, b, c], i) => (
              <li key={a} className="rise grid grid-cols-[90px_1fr_auto] gap-3 py-2 text-sm" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <span className="font-data text-xs text-turmeric">{a}</span>
                <span className="text-paper/85">{b}</span>
                <span className="font-data text-[11px] text-paper/45">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Right: the gateway */}
      <section className="flex items-center justify-center px-5 py-10 md:px-12">
        <div className="w-full max-w-md">
          <div className="font-data text-[11px] uppercase tracking-[0.2em] text-madder">Step 01 — who are you here as</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {([
              ['TEAM', 'Team', 'Ops desk, inbox, risk, settings', Headset],
              ['CUSTOMER', 'Customer', 'Storefront, orders, chat', ShoppingBag],
            ] as const).map(([r, t, d, Icon]) => (
              <button key={r} data-testid={`button-role-${r.toLowerCase()}`} onClick={() => setRole(r)}
                className={cn('relative rounded-xl border p-4 text-left transition-all duration-200',
                  role === r ? 'border-indigo bg-card shadow-[0_12px_30px_-16px_hsl(232_58%_30%/0.5)] -translate-y-0.5' : 'bg-transparent hover:bg-card')}>
                {role === r && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-indigo text-paper"><Check className="h-3 w-3" /></span>}
                <Icon className={cn('h-5 w-5', role === r ? 'text-madder' : 'text-muted-foreground')} />
                <div className="mt-3 font-display text-xl font-semibold">{t}</div>
                <div className="text-xs text-muted-foreground">{d}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border-2 border-indigo bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-lg font-semibold">Instant demo access</div>
                <div className="text-xs text-muted-foreground">No password. Seeded data, safe simulated actions.</div>
              </div>
              <span className="rounded-full bg-turmeric/20 px-2 py-0.5 font-data text-[10px] uppercase tracking-wider text-[hsl(32_80%_30%)]">Demo</span>
            </div>
            {role === 'CUSTOMER' && (
              <div className="mt-4">
                <Label className="text-xs text-muted-foreground">Fictional identity</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {IDENTITIES.map((i) => (
                    <button key={i.id} data-testid={`button-identity-${i.id}`} onClick={() => setIdent(i.id)}
                      className={cn('rounded-lg border px-2 py-1.5 text-left transition-colors', ident === i.id ? 'border-madder bg-madder/5' : 'hover:bg-accent')}>
                      <div className="font-data text-xs">{i.id}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{i.note}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  These switch which seeded customer you browse as, through demo login only. Signing in does not verify you in chat — the assistant still asks for order ID and full phone number (CUST-1006: WL10239, +91-9000010005).
                </p>
              </div>
            )}
            <button data-testid="button-demo-login" disabled={demo.isPending}
              onClick={() => demo.mutate({ data: role === 'CUSTOMER' ? { role, customerId: ident } : { role } })}
              className="group mt-4 flex w-full items-center justify-between rounded-xl bg-indigo px-4 py-3 text-paper transition-transform active:scale-[0.99] disabled:opacity-70">
              <span className="font-medium">Enter as demo {role === 'TEAM' ? 'Team' : `Customer ${ident}`}</span>
              {demo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or with an account<span className="h-px flex-1 bg-border" />
          </div>

          <div className="mb-4 inline-flex rounded-lg border bg-card p-1 text-sm">
            {(['login', 'register'] as const).map((t) => (
              <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className={cn('rounded-md px-4 py-1.5 transition-colors', tab === t ? 'bg-secondary font-medium' : 'text-muted-foreground')}>
                {t === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {tab === 'register' && (
                <div><Label htmlFor="u">Name</Label><Input id="u" data-testid="input-username" required minLength={3} autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1 bg-card" /></div>
            )}
            <div><Label htmlFor="e">Email</Label><Input id="e" type="email" data-testid="input-email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-card" /></div>
            <div><Label htmlFor="p">Password</Label><Input id="p" type="password" data-testid="input-password" required minLength={tab === 'register' ? 10 : 1} autoComplete={tab === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 bg-card" /></div>
            <button data-testid="button-submit-auth" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground/80 px-4 py-2.5 font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {tab === 'login' ? 'Sign in' : 'Create account'} as {role === 'TEAM' ? 'Team' : 'Customer'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
