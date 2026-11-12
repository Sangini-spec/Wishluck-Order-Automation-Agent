import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Lock, MapPin, Phone, Save, UserRound } from 'lucide-react';
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from '@workspace/api-client-react';
import { Panel, KV, Rows, ErrorState, Pill } from '@/components/kit';
import { addressLines } from '@/components/order-detail';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { rec, str, errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

const FIELDS = [
  { k: 'line1', label: 'Address line 1', req: true, wide: true },
  { k: 'line2', label: 'Address line 2 (optional)', req: false, wide: true },
  { k: 'landmark', label: 'Landmark (optional)', req: false, wide: true },
  { k: 'city', label: 'City', req: true },
  { k: 'state', label: 'State', req: true },
  { k: 'pincode', label: 'Pincode', req: true },
] as const;
type Form = Record<'phone' | (typeof FIELDS)[number]['k'], string>;

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  const digits = f.phone.replace(/\D/g, '');
  if (f.phone.trim().length < 10 || digits.length < 10 || digits.length > 13) e.phone = 'Enter a valid phone, e.g. +91-9000010005';
  if (!f.line1.trim()) e.line1 = 'Required';
  if (!f.city.trim()) e.city = 'Required';
  if (!f.state.trim()) e.state = 'Required';
  if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) e.pincode = 'Six digits, not starting with 0';
  return e;
}

export default function ProfilePage() {
  const { data: p, isLoading, error, refetch } = useGetProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<Form>({ phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' });
  const [touched, setTouched] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!p) return;
    const a = rec(p.address);
    setF({ phone: p.phone ?? '', line1: str(a.line1, ''), line2: str(a.line2, ''), landmark: str(a.landmark, ''), city: str(a.city, ''), state: str(a.state, ''), pincode: str(a.pincode, '') });
  }, [p]);

  const m = useUpdateProfile({
    mutation: {
      onSuccess: (np) => {
        qc.setQueryData(getGetProfileQueryKey(), np);
        invalidateData(qc);
        setSavedAt(new Date());
        setTouched(false);
        toast({ title: 'Profile saved', description: 'Your phone and address are updated.' });
      },
      onError: (e) => toast({ title: 'Could not save profile', description: errMsg(e), variant: 'destructive' }),
    },
  });

  const errs = validate(f);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errs).length) return;
    const address: Record<string, string> = { line1: f.line1.trim(), city: f.city.trim(), state: f.state.trim(), pincode: f.pincode.trim() };
    if (f.line2.trim()) address.line2 = f.line2.trim();
    if (f.landmark.trim()) address.landmark = f.landmark.trim();
    m.mutate({ data: { phone: f.phone.trim(), address } });
  };

  return (
    <>
      <div className="rise mb-8">
        <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Your details</div>
        <h1 className="font-display mt-2 text-4xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">The contact and delivery details we hold for you.</p>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading || !p ? <Rows n={4} h="h-20" /> : (
        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="block-print rounded-2xl bg-indigo p-5 text-paper">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-turmeric font-display text-2xl font-semibold text-indigo">{p.name.slice(0, 1).toUpperCase()}</div>
              <div data-testid="text-profile-name" className="font-display mt-4 text-2xl font-semibold">{p.name}</div>
              <div className="font-data text-xs text-paper/70">{p.id}</div>
              <div className="mt-3"><Pill value={p.editable ? 'Editable account' : 'Read-only demo identity'} className="border-paper/25 bg-paper/10 text-paper" /></div>
            </div>
            <Panel title="On file">
              <KV k="Email" v={<span data-testid="text-profile-email">{p.email}</span>} />
              <KV k="Phone" v={<span data-testid="text-profile-phone">{p.phone || '—'}</span>} mono />
              <div className="mt-2 flex gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo" /><div data-testid="text-profile-address">{addressLines(p.address).length ? addressLines(p.address).map((l, i) => <div key={i}>{l}</div>) : <span className="text-muted-foreground">No address saved</span>}</div></div>
              {savedAt && <div data-testid="status-profile-saved" className="rise mt-3 flex items-center gap-2 rounded-lg bg-leaf/10 px-3 py-2 text-xs text-leaf"><CheckCircle2 className="h-4 w-4" />Saved at {savedAt.toLocaleTimeString('en-IN')}</div>}
            </Panel>
          </div>

          {!p.editable ? (
            <Panel>
              <div className="flex flex-col items-start gap-3 py-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-indigo/30 bg-accent text-indigo"><Lock className="h-5 w-5" /></div>
                <h2 className="font-display text-2xl font-semibold">This identity is read-only</h2>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  This shared demo identity has fixed contact details so anyone can try the same support scenarios. Register your own Customer account to save your phone number and delivery address.
                </p>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  To change a delivery address on a specific order, ask in the help chat after verifying with your order ID and full phone number. To try profile editing, register a new Customer account from the sign-in page.
                </p>
              </div>
            </Panel>
          ) : (
            <Panel title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-indigo" />Edit contact and address</span>}>
              <form onSubmit={submit} noValidate className="space-y-4">
                <p className="text-xs text-muted-foreground">Demo-safe: details are stored only in this environment and never sent to a courier or payment provider.</p>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="phone" data-testid="input-profile-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91-9000010005" className="pl-9 font-data" />
                  </div>
                  {touched && errs.phone && <p className="mt-1 text-xs text-madder">{errs.phone}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {FIELDS.map((x) => (
                    <div key={x.k} className={cn('wide' in x && x.wide ? 'col-span-2' : 'col-span-2 sm:col-span-1')}>
                      <Label htmlFor={x.k}>{x.label}</Label>
                      <Input id={x.k} data-testid={`input-profile-${x.k}`} value={f[x.k]} inputMode={x.k === 'pincode' ? 'numeric' : undefined} maxLength={x.k === 'pincode' ? 6 : 200}
                        onChange={(e) => setF({ ...f, [x.k]: e.target.value })} className={cn('mt-1', x.k === 'pincode' && 'font-data')} />
                      {touched && errs[x.k] && <p className="mt-1 text-xs text-madder">{errs[x.k]}</p>}
                    </div>
                  ))}
                </div>
                <button data-testid="button-save-profile" disabled={m.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60">
                  {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save profile
                </button>
              </form>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
