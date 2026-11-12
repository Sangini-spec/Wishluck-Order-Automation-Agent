import { useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Check, ChevronDown, CreditCard, FlaskConical, Loader2, MapPinned, Receipt, X } from 'lucide-react';
import { useGetOrders, useGetOrder, getGetOrderQueryKey, useRespondCod, useSimulateCustomerPayment, type CodResponse, type Order } from '@workspace/api-client-react';
import { Pill, Rows, ErrorState, Empty } from '@/components/kit';
import { OrderDetail, addressLines } from '@/components/order-detail';
import { AddressFields, addressErrors, toAddressJson, type AddressForm } from '@/components/address-fields';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { arr, inr, when, str, rec, errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

const COD_DONE = /CONFIRMED|CANCEL|PAID|CONVERTED|PREPAID|EXPIRED|CLOSED|DONE/i;

function EditAddress({ order, onClose, onSubmit, pending }: { order: Order; onClose: () => void; onSubmit: (a: Record<string, string>) => void; pending: boolean }) {
  const s = rec(order.shippingAddress);
  const [a, setA] = useState<AddressForm>({ line1: str(s.line1, ''), line2: str(s.line2, ''), landmark: str(s.landmark, ''), city: str(s.city, ''), state: str(s.state, ''), pincode: str(s.pincode, '') });
  const [show, setShow] = useState(false);
  const ok = Object.keys(addressErrors(a)).length === 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card">
        <DialogHeader><DialogTitle className="font-display text-2xl">Change delivery address</DialogTitle><DialogDescription>Order {order.id}. The new address is checked again before it is accepted.</DialogDescription></DialogHeader>
        <AddressFields value={a} onChange={setA} show={show} prefix="cod-address" />
        <button data-testid="button-save-cod-address" disabled={pending} onClick={() => { setShow(true); if (ok) onSubmit(toAddressJson(a)); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm text-paper disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}Save address
        </button>
      </DialogContent>
    </Dialog>
  );
}

function OrderActions({ id }: { id: string }) {
  const { data: o, isLoading, error, refetch } = useGetOrder(id, { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addrOpen, setAddrOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const cod = useRespondCod({
    mutation: {
      onSuccess: (r, v) => {
        invalidateData(qc);
        if (v.data.action === 'PAY_ONLINE' && r.paymentId) setIssued(r.paymentId);
        if (v.data.action === 'EDIT_ADDRESS' && r.success) setAddrOpen(false);
        if (v.data.action === 'CANCEL' && r.success) setCancelOpen(false);
        toast({ title: r.success ? 'Updated' : 'Not applied', description: r.message, variant: r.success ? 'default' : 'destructive' });
      },
      onError: (e) => toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const pay = useSimulateCustomerPayment({
    mutation: {
      onSuccess: (no, v) => {
        qc.setQueryData(getGetOrderQueryKey(no.id), no);
        invalidateData(qc);
        setIssued(null);
        toast({ title: v.data.action === 'SUCCEED' ? 'Demo payment succeeded' : 'Demo payment failed', description: `Order ${no.id} is now ${no.paymentStatus ?? no.status}.`, variant: v.data.action === 'SUCCEED' ? 'default' : 'destructive' });
      },
      onError: (e) => toast({ title: 'Payment not updated', description: errMsg(e), variant: 'destructive' }),
    },
  });
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !o) return <Rows n={3} h="h-16" />;

  const c = rec(o.cod);
  const codStatus = str(c.status, '');
  const attempts = arr(o.paymentAttempts);
  const pending = attempts.filter((a) => /PENDING|CREATED|INITIATED/i.test(str(a.status, '')));
  if (issued && !pending.some((a) => a.id === issued)) pending.push({ id: issued, status: 'PENDING', purpose: 'COD_TO_PREPAID' });
  const codOpen = o.paymentMethod === 'COD' && codStatus === 'PENDING' && o.status !== 'ON_HOLD' && !/CANCEL/i.test(o.status);
  const go = (data: CodResponse) => cod.mutate({ id: o.id, data });
  const busy = (a: string) => cod.isPending && cod.variables?.data.action === a;
  const B = ({ a, icon: I, label, cls, onClick }: { a: string; icon: typeof Check; label: string; cls: string; onClick: () => void }) => (
    <button data-testid={`button-customer-${a.toLowerCase()}`} disabled={cod.isPending || pay.isPending} onClick={onClick} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50', cls)}>
      {busy(a) ? <Loader2 className="h-4 w-4 animate-spin" /> : <I className="h-4 w-4" />}{label}
    </button>
  );

  return (
    <div className="space-y-4">
      {codOpen && (
        <div data-testid="panel-cod-confirm" className="rounded-2xl border-2 border-indigo/30 bg-accent p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-display text-xl font-semibold">Confirm your cash on delivery order</div>
            <Pill value={codStatus} testId="status-customer-cod" />
          </div>
           <p className="mt-1 text-sm text-muted-foreground">Pay {inr(rec(o.payment).amountDueAtDelivery ?? o.total)} when it arrives at {addressLines(o.shippingAddress).join(', ')}.{c.messageSentAt ? ` We messaged you ${when(c.messageSentAt)}.` : ' Your confirmation message is being prepared.'}</p>
           {!!c.messageSentAt && <div className="mt-3 flex flex-wrap gap-2">
            <B a="CONFIRM" icon={Check} label="Confirm order" cls="bg-leaf text-paper" onClick={() => go({ action: 'CONFIRM' })} />
            <B a="EDIT_ADDRESS" icon={MapPinned} label="Edit address" cls="border bg-card" onClick={() => setAddrOpen(true)} />
            <B a="PAY_ONLINE" icon={CreditCard} label="Pay online, save 5%" cls="border border-indigo bg-card text-indigo" onClick={() => go({ action: 'PAY_ONLINE' })} />
             <B a="CANCEL" icon={X} label="Cancel order" cls="text-madder hover:bg-madder/10" onClick={() => setCancelOpen(true)} />
           </div>}
        </div>
      )}
       {o.status === 'ON_HOLD' && <div className="rounded-xl border border-turmeric/50 bg-turmeric/10 p-4 text-sm">This order is on hold. Contact our support team through the chat for help.</div>}
      {pending.map((a) => {
        const pid = str(a.id, '');
        return (
          <div key={pid} data-testid={`panel-pending-payment-${pid}`} className="rise rounded-2xl border-2 border-dashed border-turmeric bg-turmeric/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><FlaskConical className="h-4 w-4" />Demo payment pending</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
              <span className="font-data text-sm">{pid}</span>
              {a.amount != null && <span className="font-data text-lg">{inr(a.amount)}</span>}
              {!!a.discount && <span className="text-xs text-leaf">includes {inr(a.discount)} off</span>}
              {a.purpose != null && <span className="text-xs text-muted-foreground">{str(a.purpose)}</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">No real gateway is connected. Choose the outcome the payment provider would report. Your order is not paid until success is recorded.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button data-testid={`button-pay-succeed-${pid}`} disabled={pay.isPending} onClick={() => pay.mutate({ id: o.id, data: { paymentId: pid, action: 'SUCCEED' } })} className="inline-flex items-center gap-2 rounded-lg bg-indigo px-3 py-2 text-sm text-paper disabled:opacity-50">
                {pay.isPending && pay.variables?.data.action === 'SUCCEED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}Simulate success
              </button>
              <button data-testid={`button-pay-fail-${pid}`} disabled={pay.isPending} onClick={() => pay.mutate({ id: o.id, data: { paymentId: pid, action: 'FAIL' } })} className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-madder disabled:opacity-50">
                {pay.isPending && pay.variables?.data.action === 'FAIL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}Simulate failure
              </button>
            </div>
          </div>
        );
      })}
      {attempts.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Payment attempts</div>
          <ul className="space-y-1 text-sm">
            {attempts.map((a) => (
              <li key={str(a.id)} className="flex flex-wrap items-center gap-3"><span className="font-data text-xs">{str(a.id)}</span><Pill value={a.status} /><span className="text-xs text-muted-foreground">{str(a.purpose, '')}</span><span className="ml-auto font-data">{inr(a.amount)}</span></li>
            ))}
          </ul>
        </div>
      )}
      <OrderDetail order={o} compact />
       <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
         <DialogContent className="bg-card">
           <DialogHeader><DialogTitle>Cancel this order?</DialogTitle><DialogDescription>Order {o.id} has not shipped. Cancelling releases its reserved stock and cannot be undone.</DialogDescription></DialogHeader>
           <div className="flex justify-end gap-2">
             <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => setCancelOpen(false)} disabled={cod.isPending}>Keep order</button>
             <button data-testid="button-confirm-cancel-order" className="rounded-lg bg-madder px-4 py-2 text-sm text-paper disabled:opacity-50" disabled={cod.isPending} onClick={() => go({ action: 'CANCEL' })}>{cod.isPending ? 'Cancelling…' : 'Yes, cancel order'}</button>
           </div>
         </DialogContent>
       </Dialog>
      {addrOpen && <EditAddress order={o} onClose={() => setAddrOpen(false)} pending={busy('EDIT_ADDRESS')} onSubmit={(address) => go({ action: 'EDIT_ADDRESS', address })} />}
    </div>
  );
}

export default function MyOrders() {
  const { data, isLoading, error, refetch } = useGetOrders();
  const search = useSearch();
  const [, nav] = useLocation();
  const open = new URLSearchParams(search).get('order');
  const setOpen = (id: string | null) => nav(id ? `/store/orders?order=${encodeURIComponent(id)}` : '/store/orders', { replace: true });
  return (
    <>
      <div className="rise mb-8">
        <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Your history</div>
        <h1 className="font-display mt-2 text-4xl font-semibold">My orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm cash on delivery, change an address or finish a demo payment here. Questions? Open the chat.</p>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={4} h="h-20" /> : !data?.length ? (
        <Empty icon={<Receipt className="h-6 w-6" />} title="No orders yet" body="Orders you place will appear here." action={<Link href="/store" data-testid="link-shop" className="rounded-lg bg-indigo px-3 py-1.5 text-sm text-paper">Browse the shop</Link>} />
      ) : (
        <ul className="space-y-3">
          {data.map((o) => {
            const items = arr(o.items);
            const isOpen = open === o.id;
            const needs = (o.paymentMethod === 'COD' && rec(o.cod).status && !COD_DONE.test(str(rec(o.cod).status, '')) && !/CANCEL/i.test(o.status)) || arr(o.paymentAttempts).some((a) => /PENDING|CREATED|INITIATED/i.test(str(a.status, '')));
            return (
              <li key={o.id} className={cn('overflow-hidden rounded-xl border bg-card', isOpen && 'border-indigo/40 shadow-sm')}>
                <button data-testid={`row-my-order-${o.id}`} onClick={() => setOpen(isOpen ? null : o.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-left hover:bg-accent/30">
                  <span className="font-data font-medium text-indigo">{o.id}</span>
                  <span className="text-sm text-muted-foreground">{when(o.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{items.map((i) => str(i.productName ?? i.name)).join(', ')}</span>
                  {needs && <span data-testid={`status-action-needed-${o.id}`} className="rounded-full bg-turmeric/30 px-2 py-0.5 text-[11px] font-medium">Action needed</span>}
                  <Pill value={o.status} /><span className="font-data text-sm">{inr(o.total)}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && <div className="border-t bg-background/60 p-4"><OrderActions id={o.id} /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
