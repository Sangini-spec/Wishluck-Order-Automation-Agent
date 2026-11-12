import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useGetCart, useChangeCart, getGetCartQueryKey } from '@workspace/api-client-react';
import { ProductImage } from '@/components/product-image';
import { Rows, ErrorState, Empty, KV } from '@/components/kit';
import { useToast } from '@/hooks/use-toast';
import { inr, errMsg } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function CartPage() {
  const { data: cart, isLoading, error, refetch } = useGetCart();
  const qc = useQueryClient();
  const { toast } = useToast();
  const change = useChangeCart({
    mutation: {
      onSuccess: (c) => qc.setQueryData(getGetCartQueryKey(), c),
      onError: (e) => { toast({ title: 'Bag not updated', description: errMsg(e), variant: 'destructive' }); refetch(); },
    },
  });
  const set = (sku: string, size: string, quantity: number) => change.mutate({ data: { sku, size, quantity, mode: 'SET' } });
  const busy = (sku: string, size: string) => change.isPending && change.variables?.data.sku === sku && change.variables?.data.size === size;
  const blocked = cart?.items.some((i) => i.quantity > i.available) ?? false;

  return (
    <>
      <div className="rise mb-8">
        <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Your bag</div>
        <h1 className="font-display mt-2 text-4xl font-semibold">Shopping bag</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saved to your account, so it is here on any device.</p>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading || !cart ? <Rows n={3} h="h-24" /> : cart.items.length === 0 ? (
        <Empty icon={<ShoppingBag className="h-6 w-6" />} title="Your bag is empty" body="Pick a style and a size, and it will wait here for you." action={<Link href="/store" data-testid="link-shop" className="rounded-lg bg-indigo px-3 py-1.5 text-sm text-paper">Browse the shop</Link>} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <ul className="space-y-3">
            {cart.items.map((i, idx) => {
              const over = i.quantity > i.available;
              return (
                <li key={`${i.sku}-${i.size}`} data-testid={`row-cart-${i.sku}-${i.size}`} className="rise flex gap-4 rounded-2xl border bg-card p-3" style={{ animationDelay: `${idx * 50}ms` }}>
                  <Link href={`/store/product/${i.sku}`} className="w-20 shrink-0 overflow-hidden rounded-xl bg-secondary sm:w-24"><ProductImage sku={i.sku} name={i.name} className="aspect-[5/6] w-full" /></Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/store/product/${i.sku}`} className="font-display text-lg font-semibold leading-tight hover:underline">{i.name}</Link>
                        <div className="font-data text-[11px] text-muted-foreground">{i.sku} · Size {i.size} · {inr(i.unitPrice)} each</div>
                      </div>
                      <div data-testid={`text-line-total-${i.sku}-${i.size}`} className="font-data text-sm">{inr(i.lineTotal)}</div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                      <div className={cn('flex items-center rounded-lg border bg-background', busy(i.sku, i.size) && 'opacity-60')}>
                        <button data-testid={`button-dec-${i.sku}-${i.size}`} disabled={change.isPending || i.quantity <= 1} onClick={() => set(i.sku, i.size, i.quantity - 1)} className="p-2 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-7 text-center font-data text-sm">{busy(i.sku, i.size) ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : i.quantity}</span>
                        <button data-testid={`button-inc-${i.sku}-${i.size}`} disabled={change.isPending || i.quantity >= Math.min(10, i.available)} onClick={() => set(i.sku, i.size, i.quantity + 1)} className="p-2 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <span className={cn('font-data text-[11px]', over ? 'text-madder' : i.available <= 3 ? 'text-[hsl(32_80%_30%)]' : 'text-muted-foreground')}>
                        {i.available === 0 ? 'Out of stock' : over ? `Only ${i.available} available` : `${i.available} in stock`}
                      </span>
                      {over && i.available > 0 && <button data-testid={`button-fix-${i.sku}-${i.size}`} onClick={() => set(i.sku, i.size, i.available)} className="text-xs text-indigo underline">Reduce to {i.available}</button>}
                      <button data-testid={`button-remove-${i.sku}-${i.size}`} disabled={change.isPending} onClick={() => set(i.sku, i.size, 0)} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-madder"><Trash2 className="h-3.5 w-3.5" />Remove</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
            <div className="font-display text-xl font-semibold">Summary</div>
            <div className="mt-3">
              <KV k={`Items (${cart.count})`} v={<span data-testid="text-cart-subtotal">{inr(cart.subtotal)}</span>} mono />
              <KV k="Shipping and COD fees" v="At checkout" />
            </div>
            {blocked && <p className="mt-3 flex gap-2 rounded-lg bg-madder/10 p-2.5 text-xs text-madder"><AlertTriangle className="h-4 w-4 shrink-0" />Some items exceed available stock. Adjust them to continue.</p>}
            {blocked ? (
              <span className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-indigo/50 px-4 py-3 text-sm text-paper">Checkout</span>
            ) : (
              <Link href="/store/checkout" data-testid="link-checkout" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-3 text-sm font-medium text-paper">Checkout<ArrowRight className="h-4 w-4" /></Link>
            )}
            <div className="mt-2 font-data text-[10px] text-muted-foreground">Bag version {cart.version}</div>
          </aside>
        </div>
      )}
    </>
  );
}
