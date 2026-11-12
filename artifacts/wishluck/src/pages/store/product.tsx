import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, Minus, Plus, RefreshCw, ShoppingBag, Undo2, X } from 'lucide-react';
import { useGetProducts, useGetCart, useChangeCart, getGetCartQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { ProductImage } from '@/components/product-image';
import { Rows, ErrorState, Empty } from '@/components/kit';
import { inr, errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ProductPage() {
  const { sku = '' } = useParams<{ sku: string }>();
  const { data, isLoading, error, refetch } = useGetProducts();
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const cart = useGetCart();
  const change = useChangeCart({
    mutation: {
      onSuccess: (c) => { qc.setQueryData(getGetCartQueryKey(), c); setAdded(true); toast({ title: 'Added to bag', description: `${c.count} item${c.count === 1 ? '' : 's'} in your bag.` }); },
      onError: (e) => toast({ title: 'Could not add to bag', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const p = data?.find((x) => x.sku === sku);
  const inBag = cart.data?.items.find((i) => i.sku === sku && i.size === size)?.quantity ?? 0;
  return (
    <>
      <Link href="/store" data-testid="link-back-store" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to shop</Link>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={2} h="h-64" /> : !p ? (
        <Empty icon={<X className="h-6 w-6" />} title="Style not found" body={`No product with SKU ${sku}.`} action={<Link href="/store" data-testid="link-shop" className="rounded-lg border px-3 py-1.5 text-sm">Browse the shop</Link>} />
      ) : (
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="rise h-fit overflow-hidden rounded-2xl border bg-secondary md:sticky md:top-24"><ProductImage sku={p.sku} name={p.name} eager className="aspect-[5/6] w-full" /></div>
          <div className="rise" style={{ animationDelay: '80ms' }}>
            <div className="font-data text-xs text-muted-foreground">{p.sku} · {p.category}</div>
            <h1 className="font-display mt-2 text-4xl font-semibold leading-tight md:text-5xl">{p.name}</h1>
            <div className="font-data mt-3 text-2xl">{inr(p.price)}</div>
            <div className="mt-8">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Size and stock</div>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map((s) => {
                  const avail = p.inventory.find((i) => i.size === s)?.available ?? 0;
                  return (
                    <button key={s} data-testid={`button-size-${s}`} onClick={() => { setSize(s); setQty(1); setAdded(false); }} disabled={avail === 0}
                      className={cn('min-w-14 rounded-lg border px-3 py-2 text-sm transition-all', size === s ? 'border-indigo bg-indigo text-paper' : 'bg-card hover:border-indigo', avail === 0 && 'cursor-not-allowed line-through opacity-40')}>
                      {s}<div className="font-data text-[10px] opacity-70">{avail} left</div>
                    </button>
                  );
                })}
              </div>
              {size && (() => {
                const avail = p.inventory.find((i) => i.size === size)?.available ?? 0;
                const max = Math.max(0, Math.min(10, avail) - inBag);
                return (
                  <div className="rise mt-6 rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center rounded-lg border">
                        <button data-testid="button-qty-minus" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="p-2.5 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                        <span data-testid="text-qty" className="w-8 text-center font-data">{qty}</span>
                        <button data-testid="button-qty-plus" disabled={qty >= max} onClick={() => setQty(qty + 1)} className="p-2.5 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                      </div>
                      <button data-testid="button-add-to-cart" disabled={change.isPending || max === 0 || qty > max} onClick={() => change.mutate({ data: { sku: p.sku, size, quantity: qty, mode: 'ADD' } })}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo px-5 py-3 text-sm font-medium text-paper transition-transform active:scale-[0.98] disabled:opacity-50">
                        {change.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}Add to bag
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Size {size}{inBag ? ` · ${inBag} already in your bag` : ''}{max === 0 ? ' · no more stock available for you' : ''}. Final prices are confirmed at checkout.</p>
                    {added && <Link href="/store/cart" data-testid="link-view-cart" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo underline underline-offset-4">View bag and check out</Link>}
                  </div>
                );
              })()}
            </div>
            <div className="mt-8 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Returns and delivery</div>
            <ul className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
              <li className="flex items-center gap-2">{p.returnable ? <Undo2 className="h-4 w-4 text-leaf" /> : <X className="h-4 w-4 text-madder" />}{p.returnable ? 'Returnable within policy window' : 'Not returnable'}</li>
              <li className="flex items-center gap-2">{p.exchangeable ? <RefreshCw className="h-4 w-4 text-leaf" /> : <X className="h-4 w-4 text-madder" />}{p.exchangeable ? 'Size exchange available' : 'No exchanges'}</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo" />Cash on delivery where eligible</li>
            </ul>
            {p.notes && <p className="mt-6 border-l-2 border-turmeric pl-4 text-sm leading-relaxed text-muted-foreground">{p.notes}</p>}
          </div>
        </div>
      )}
    </>
  );
}
