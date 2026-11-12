import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, Check, CreditCard, Loader2, MapPinned, Play, X, BadgeCheck } from 'lucide-react';
import { useGetOrders, getGetOrdersQueryKey, useGetOrder, getGetOrderQueryKey, useRespondCod, type CodResponse, type Order } from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState, Empty, Panel, KV } from '@/components/kit';
import { RiskGauge, Warnings, addressLines } from '@/components/order-detail';
import { CreateTestOrder } from '@/components/test-order';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { rec, num, str, inr, when, errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

const ADDR = ['line1', 'line2', 'landmark', 'city', 'state', 'pincode', 'zone', 'country'] as const;

function AddressDialog({ order, open, setOpen, onSubmit, pending }: { order: Order; open: boolean; setOpen: (b: boolean) => void; onSubmit: (a: Record<string, string>) => void; pending: boolean }) {
  const src = rec(order.shippingAddress);
  const [a, setA] = useState<Record<string, string>>(() => Object.fromEntries(ADDR.map((k) => [k, str(src[k], '')])));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card">
        <DialogHeader><DialogTitle className="font-display text-2xl">Edit delivery address</DialogTitle><DialogDescription>Sends structured address JSON with action EDIT_ADDRESS.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {ADDR.map((k) => (
            <div key={k} className={cn(k === 'line1' || k === 'line2' ? 'col-span-2' : '')}>
              <Label className="capitalize">{k === 'line1' ? 'Address line 1' : k === 'line2' ? 'Address line 2' : k}</Label>
              <Input data-testid={`input-address-${k}`} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} className="mt-1" />
            </div>
          ))}
        </div>
        <button data-testid="button-save-address" disabled={!a.line1 || !a.city || !/^\d{6}$/.test(a.pincode) || pending} onClick={() => onSubmit(Object.fromEntries(Object.entries(a).filter(([, v]) => v.trim())))} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm text-paper disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}Send updated address
        </button>
        {!/^\d{6}$/.test(a.pincode) && <p className="text-xs text-madder">Pincode must be 6 digits.</p>}
      </DialogContent>
    </Dialog>
  );
}

function Workbench({ id }: { id: string }) {
  const { data: o, isLoading, error, refetch } = useGetOrder(id, { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const m = useRespondCod({
    mutation: {
      onSuccess: (r, vars) => {
        invalidateData(qc);
        if (vars.data.action === 'PAY_ONLINE') setPaymentId(r.paymentId ?? null);
        if (vars.data.action === 'PAYMENT_SUCCESS') setPaymentId(null);
        if (vars.data.action === 'EDIT_ADDRESS') setAddrOpen(false);
        toast({ title: r.success ? 'Done' : 'Not applied', description: r.message, variant: r.success ? 'default' : 'destructive' });
      },
      onError: (e) => toast({ title: 'COD action failed', description: errMsg(e), variant: 'destructive' }),
    },
  });
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !o) return <Rows n={4} h="h-24" />;
  const cod = rec(o.cod);
  const pay = rec(o.payment);
  const go = (data: CodResponse) => m.mutate({ id: o.id, data });
  const busy = (a: string) => m.isPending && m.variables?.data.action === a;
  const Btn = ({ a, icon: I, label, cls, onClick }: { a: string; icon: typeof Check; label: string; cls: string; onClick: () => void }) => (
    <button data-testid={`button-cod-${a.toLowerCase()}`} disabled={m.isPending} onClick={onClick} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50', cls)}>
      {busy(a) ? <Loader2 className="h-4 w-4 animate-spin" /> : <I className="h-4 w-4" />}{label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/ops/orders/${o.id}`} data-testid="link-cod-order" className="font-display text-2xl font-semibold text-indigo hover:underline">{o.id}</Link>
        <span className="text-sm text-muted-foreground">{o.customerName} · {o.customerPhone}</span>
        <Pill value={cod.status ?? 'No COD record'} testId="status-cod" />
        <Pill value={o.paymentStatus ?? pay.status} />
      </div>
      <Warnings order={o} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Why this risk score"><RiskGauge risk={o.risk} /></Panel>
        <Panel title="Confirmation workflow">
          <KV k="Amount due at delivery" v={inr(pay.amountDueAtDelivery ?? o.total)} mono />
          <KV k="Message sent" v={when(cod.messageSentAt)} />
          <KV k="Reminder sent" v={when(cod.reminderSentAt)} />
          <KV k="Held at" v={when(cod.heldAt)} />
          <div className="rule-dotted my-3" />
          <p className="mb-3 text-xs text-muted-foreground">Seeding sends nothing. START deliberately begins the imported pending workflow; the remaining buttons simulate explicit customer choices.</p>
          <div className="flex flex-wrap gap-2">
            <Btn a="START" icon={Play} label="Start workflow" cls="bg-indigo text-paper" onClick={() => go({ action: 'START' })} />
            <Btn a="CONFIRM" icon={Check} label="Customer confirms" cls="bg-leaf text-paper" onClick={() => go({ action: 'CONFIRM' })} />
            <Btn a="CANCEL" icon={X} label="Customer cancels" cls="bg-madder text-paper" onClick={() => go({ action: 'CANCEL' })} />
            <Btn a="EDIT_ADDRESS" icon={MapPinned} label="Edit address" cls="border bg-card" onClick={() => setAddrOpen(true)} />
            <Btn a="PAY_ONLINE" icon={CreditCard} label="Switch to pay online" cls="border bg-card" onClick={() => go({ action: 'PAY_ONLINE' })} />
          </div>
          {paymentId && (
            <div data-testid="panel-payment-pending" className="rise mt-4 rounded-xl border-2 border-dashed border-indigo/40 bg-accent p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Simulated payment link issued</div>
              <div className="font-data mt-1 text-sm">{paymentId}</div>
              <p className="mt-1 text-xs text-muted-foreground">Order is not paid yet. Confirm the simulated gateway callback to mark it paid.</p>
              <Btn a="PAYMENT_SUCCESS" icon={BadgeCheck} label="Simulate payment success" cls="mt-3 bg-indigo text-paper" onClick={() => go({ action: 'PAYMENT_SUCCESS', paymentId })} />
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Ship to"><div className="text-sm">{addressLines(o.shippingAddress).join(' · ')}</div></Panel>
      {addrOpen && <AddressDialog order={o} open={addrOpen} setOpen={setAddrOpen} pending={busy('EDIT_ADDRESS')} onSubmit={(address) => go({ action: 'EDIT_ADDRESS', address })} />}
    </div>
  );
}

export default function Cod() {
  const search = useSearch();
  const [, nav] = useLocation();
  const sel = new URLSearchParams(search).get('order') ?? '';
  const { data, isLoading, error, refetch } = useGetOrders(undefined, { query: { queryKey: getGetOrdersQueryKey(), refetchInterval: 15000 } });
  const [band, setBand] = useState('ALL');
  const cods = useMemo(() => (data ?? []).filter((o) => o.paymentMethod === 'COD')
    .map((o) => ({ o, score: num(rec(o.risk).score ?? rec(o.cod).riskScore), band: str(rec(o.risk).band ?? rec(o.cod).riskBand, 'UNKNOWN') }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [data]);
  const bands = Array.from(new Set(cods.map((c) => c.band)));
  const shown = cods.filter((c) => band === 'ALL' || c.band === band);
  return (
    <>
      <PageHeader kicker="Cash on delivery" title="COD risk desk" sub="Customer checkouts land here automatically as they are placed. Every score comes with its reasons; team buttons below simulate customer choices for imported orders.">
        <CreateTestOrder />
      </PageHeader>
      {error ? <ErrorState error={error} retry={refetch} /> : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {['ALL', ...bands].map((b) => <button key={b} data-testid={`filter-band-${b.toLowerCase()}`} onClick={() => setBand(b)} className={cn('rounded-full border px-2.5 py-1 text-xs', band === b ? 'border-indigo bg-indigo text-paper' : 'bg-card hover:bg-accent')}>{b === 'ALL' ? 'All bands' : b}</button>)}
            </div>
            {isLoading ? <Rows n={6} /> : shown.length === 0 ? <Panel><Empty icon={<Banknote className="h-6 w-6" />} title="No COD orders" body="Waiting for customers. COD orders placed in the storefront appear here live." /></Panel> : (
              <ul className="max-h-[70dvh] space-y-1 overflow-auto pr-1">
                {shown.map(({ o, score, band: b }) => (
                  <li key={o.id}>
                    <button data-testid={`row-cod-${o.id}`} onClick={() => nav(`/ops/cod?order=${o.id}`)} className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all', sel === o.id ? 'border-indigo bg-card shadow-sm' : 'border-transparent hover:bg-card')}>
                      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg font-data text-sm font-medium', /HIGH/i.test(b) ? 'bg-madder/15 text-madder' : /MED/i.test(b) ? 'bg-turmeric/20 text-[hsl(32_80%_30%)]' : 'bg-leaf/10 text-leaf')}>{score ?? '—'}</div>
                      <div className="min-w-0 flex-1"><div className="font-data text-sm">{o.id}</div><div className="truncate text-xs text-muted-foreground">{o.customerName} · {inr(o.total)}</div></div>
                      {o.origin && /STORE|CHECKOUT|CUSTOMER/i.test(o.origin) && <span className="rounded bg-turmeric/25 px-1.5 py-0.5 font-data text-[9px] uppercase tracking-wider">Store</span>}<Pill value={rec(o.cod).status ?? o.status} className="hidden xl:inline-flex" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>{sel ? <Workbench key={sel} id={sel} /> : <Panel><Empty icon={<Banknote className="h-6 w-6" />} title="Choose a COD order" body="Orders are sorted by risk score, highest first. Pick one to see why it scored that way." /></Panel>}</div>
        </div>
      )}
    </>
  );
}
