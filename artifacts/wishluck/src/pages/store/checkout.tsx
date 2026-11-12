import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, CreditCard, FlaskConical, Loader2, Lock, ShoppingBag } from 'lucide-react';
import {
  useGetCart, useGetProfile, useGetCheckoutQuote, useSubmitCheckout, getGetCartQueryKey,
  type CheckoutQuote, type CheckoutDetailsPaymentMethod,
} from '@workspace/api-client-react';
import { Rows, ErrorState, Empty, KV } from '@/components/kit';
import { AddressFields, addressErrors, emptyAddress, phoneError, toAddressJson, type AddressForm } from '@/components/address-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { inr, errMsg, rec, str } from '@/lib/format';
import { cn } from '@/lib/utils';

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `wl-${crypto.randomUUID()}` : `wl-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function CheckoutPage() {
  const cart = useGetCart();
  const profile = useGetProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [method, setMethod] = useState<CheckoutDetailsPaymentMethod>('COD');
  const [phone, setPhone] = useState('');
  const [addr, setAddr] = useState<AddressForm>(emptyAddress);
  const [saveProfile, setSaveProfile] = useState(false);
  const [show, setShow] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quotedFingerprint, setQuotedFingerprint] = useState('');
  const [quoteErr, setQuoteErr] = useState('');
  const prefilled = useRef(false);
  const keyRef = useRef<{ fp: string; key: string } | null>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p || profile.isFetching || prefilled.current) return;
    prefilled.current = true;
    const a = rec(p.address);
    setPhone(p.phone ?? '');
    setAddr({ line1: str(a.line1, ''), line2: str(a.line2, ''), landmark: str(a.landmark, ''), city: str(a.city, ''), state: str(a.state, ''), pincode: str(a.pincode, '') });
  }, [profile.data, profile.isFetching]);

  const addressJson = useMemo(() => toAddressJson(addr), [addr]);
  const formValid = !phoneError(phone) && Object.keys(addressErrors(addr)).length === 0;
  const version = cart.data?.version ?? 0;
  const fp = JSON.stringify({ method, phone: phone.trim(), addressJson, version, saveProfile });

  const quoteM = useGetCheckoutQuote({
    mutation: {
      onSuccess: (q, v) => {
        setQuote(q);
        setQuotedFingerprint(JSON.stringify({ method: v.data.paymentMethod, phone: v.data.phone, addressJson: v.data.address, version: q.cartVersion }));
        setQuoteErr('');
      },
      onError: (e) => { setQuote(null); setQuotedFingerprint(''); setQuoteErr(errMsg(e)); },
    },
  });
  const quoteRef = useRef(quoteM.mutate);
  quoteRef.current = quoteM.mutate;
  const quoteFp = JSON.stringify({ method, phone: phone.trim(), addressJson, version });
  useEffect(() => {
    if (!formValid || !version) { setQuote(null); return; }
    const t = setTimeout(() => quoteRef.current({ data: { paymentMethod: method, phone: phone.trim(), address: addressJson } }), 400);
    return () => clearTimeout(t);
    // quoteFp captures all inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteFp, formValid]);

  const submit = useSubmitCheckout({
    mutation: {
      onSuccess: (o) => {
        keyRef.current = null;
        qc.removeQueries({ queryKey: getGetCartQueryKey() });
        invalidateData(qc);
        toast({ title: `Order ${o.id} placed`, description: o.paymentMethod === 'COD' ? 'We will ask you to confirm cash on delivery.' : 'Complete the demo payment to finish.' });
        nav(`/store/orders?order=${encodeURIComponent(o.id)}`);
      },
      onError: (e) => {
        toast({ title: 'Order not placed', description: `${errMsg(e)} You can retry safely; we will not create a duplicate.`, variant: 'destructive' });
        cart.refetch();
      },
    },
  });

  const quoteCurrent = !!quote && quote.cartVersion === version && quotedFingerprint === quoteFp && !quoteM.isPending;
  const canPlace = formValid && quoteCurrent && !!quote?.eligible && !submit.isPending;

  const place = () => {
    setShow(true);
    if (!canPlace || !quote) return;
    if (!keyRef.current || keyRef.current.fp !== fp) keyRef.current = { fp, key: newKey() };
    submit.mutate({ data: { paymentMethod: method, phone: phone.trim(), address: addressJson, cartVersion: quote.cartVersion, idempotencyKey: keyRef.current.key, saveProfile } });
  };

  if (cart.error) return <ErrorState error={cart.error} retry={cart.refetch} />;
  if (profile.error) return <ErrorState error={profile.error} retry={profile.refetch} />;
  if (cart.isLoading || !cart.data || profile.isLoading || (!prefilled.current && profile.isFetching)) return <Rows n={4} h="h-24" />;
  if (cart.data.items.length === 0) {
    return <Empty icon={<ShoppingBag className="h-6 w-6" />} title="Nothing to check out" body="Your bag is empty. If you just placed an order, find it under My orders." action={<Link href="/store" data-testid="link-shop" className="rounded-lg bg-indigo px-3 py-1.5 text-sm text-paper">Browse the shop</Link>} />;
  }

  const items = quote?.items ?? cart.data.items;
  const Method = ({ m, icon: I, title, body }: { m: CheckoutDetailsPaymentMethod; icon: typeof Banknote; title: string; body: string }) => (
    <button type="button" data-testid={`button-method-${m.toLowerCase()}`} onClick={() => setMethod(m)}
      className={cn('flex flex-1 items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors', method === m ? 'border-indigo bg-accent' : 'border-border bg-card hover:border-indigo/40')}>
      <I className={cn('mt-0.5 h-5 w-5', method === m ? 'text-indigo' : 'text-muted-foreground')} />
      <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{body}</span></span>
    </button>
  );

  return (
    <>
      <Link href="/store/cart" data-testid="link-back-cart" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to bag</Link>
      <div className="rise mb-8">
        <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Checkout</div>
        <h1 className="font-display mt-2 text-4xl font-semibold">Where should it go?</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</div>
            <Label htmlFor="co-phone" className="text-xs">Phone</Label>
            <Input id="co-phone" data-testid="input-checkout-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={cn('mt-1 bg-background', show && phoneError(phone) && 'border-madder')} />
            {show && phoneError(phone) && <p className="mt-1 text-[11px] text-madder">{phoneError(phone)}</p>}
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Delivery address</div>
            <AddressFields value={addr} onChange={setAddr} show={show} prefix="checkout" />
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" data-testid="checkbox-save-profile" checked={saveProfile} onChange={(e) => setSaveProfile(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Save these details to my profile
            </label>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Method m="COD" icon={Banknote} title="Cash on delivery" body="Pay the courier. We will ask you to confirm first." />
              <Method m="PREPAID" icon={CreditCard} title="Pay online" body="Simulated gateway, no real money moves." />
            </div>
            <div data-testid="panel-demo-payment" className="mt-4 flex gap-3 rounded-xl border border-dashed border-turmeric bg-turmeric/10 p-3 text-xs leading-relaxed">
              <FlaskConical className="h-4 w-4 shrink-0 text-[hsl(32_80%_30%)]" />
              <span>This is a demo store. {method === 'PREPAID' ? 'Placing the order creates a pending payment. You then choose to simulate success or failure on your order page. No card details are collected and nothing is charged.' : 'No money is collected. After placing, you confirm, cancel, edit the address or switch to a simulated online payment from your order page.'}{quote && !quote.demoPayment ? ' The server reports a non-demo payment mode.' : ''}</span>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-2">
            <div className="font-display text-xl font-semibold">Order summary</div>
            {quoteM.isPending && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((i) => (
              <li key={`${i.sku}-${i.size}`} className="flex gap-2"><span className="min-w-0 flex-1 truncate">{i.name} <span className="text-muted-foreground">· {i.size} x {i.quantity}</span></span><span className="font-data">{inr(i.lineTotal)}</span></li>
            ))}
          </ul>
          <div className="rule-dotted my-3" />
          {!formValid ? (
            <p className="text-xs text-muted-foreground">Enter a valid phone and address to get your delivery quote.</p>
          ) : quoteErr ? (
            <p data-testid="text-quote-error" className="flex gap-2 text-xs text-madder"><AlertTriangle className="h-4 w-4 shrink-0" />{quoteErr}</p>
          ) : !quote ? (
            <Rows n={3} h="h-5" />
          ) : (
            <div data-testid="panel-quote" className={cn(quoteM.isPending && 'opacity-60')}>
              <KV k="Subtotal" v={inr(quote.subtotal)} mono />
              <KV k="Shipping" v={quote.shippingFee ? inr(quote.shippingFee) : 'Free'} mono />
              {method === 'COD' && <KV k="COD fee" v={inr(quote.codFee)} mono />}
              <div className="mt-2 flex items-baseline justify-between border-t pt-2"><span className="text-sm font-medium">Total</span><span data-testid="text-quote-total" className="font-data text-xl">{inr(quote.total)}</span></div>
              <div data-testid="status-eligibility" className={cn('mt-3 flex gap-2 rounded-lg p-2.5 text-xs', quote.eligible ? 'bg-leaf/10 text-leaf' : 'bg-madder/10 text-madder')}>
                {quote.eligible ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{quote.reason || (quote.eligible ? 'Deliverable to this address.' : 'Not available for this address.')}</span>
              </div>
              {quote.cartVersion !== version && <p className="mt-2 text-xs text-madder">Your bag changed. Refreshing quote.</p>}
            </div>
          )}
          <button data-testid="button-place-order" onClick={place} disabled={submit.isPending || (show && !canPlace)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-3 text-sm font-medium text-paper transition-transform active:scale-[0.98] disabled:opacity-50">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {submit.isPending ? 'Placing order' : method === 'COD' ? 'Place COD order' : 'Place order and pay (demo)'}
          </button>
          {submit.isError && <p className="mt-2 text-[11px] text-muted-foreground">Retrying sends the same request key, so a repeated tap cannot double-order.</p>}
        </aside>
      </div>
    </>
  );
}
