import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Check, RefreshCw, Undo2, X } from 'lucide-react';
import { useGetProducts } from '@workspace/api-client-react';
import { Motif, Rows, ErrorState, Empty } from '@/components/kit';
import { inr } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ProductPage() {
  const { sku = '' } = useParams<{ sku: string }>();
  const { data, isLoading, error, refetch } = useGetProducts();
  const [size, setSize] = useState('');
  const p = data?.find((x) => x.sku === sku);
  return (
    <>
      <Link href="/store" data-testid="link-back-store" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to shop</Link>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={2} h="h-64" /> : !p ? (
        <Empty icon={<X className="h-6 w-6" />} title="Style not found" body={`No product with SKU ${sku}.`} action={<Link href="/store" data-testid="link-shop" className="rounded-lg border px-3 py-1.5 text-sm">Browse the shop</Link>} />
      ) : (
        <div className="grid gap-10 md:grid-cols-2">
          <div className="rise overflow-hidden rounded-2xl border bg-secondary"><Motif seed={p.sku} label={p.name} className="aspect-[5/6] w-full" /></div>
          <div className="rise" style={{ animationDelay: '80ms' }}>
            <div className="font-data text-xs text-muted-foreground">{p.sku} · {p.category}</div>
            <h1 className="font-display mt-2 text-4xl font-semibold">{p.name}</h1>
            <div className="font-data mt-3 text-2xl">{inr(p.price)}</div>
            <div className="mt-8">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Size and stock</div>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map((s) => {
                  const avail = p.inventory.find((i) => i.size === s)?.available ?? 0;
                  return (
                    <button key={s} data-testid={`button-size-${s}`} onClick={() => setSize(s)} disabled={avail === 0}
                      className={cn('min-w-14 rounded-lg border px-3 py-2 text-sm transition-all', size === s ? 'border-indigo bg-indigo text-paper' : 'bg-card hover:border-indigo', avail === 0 && 'cursor-not-allowed line-through opacity-40')}>
                      {s}<div className="font-data text-[10px] opacity-70">{avail} left</div>
                    </button>
                  );
                })}
              </div>
              {size && <p className="mt-2 text-xs text-muted-foreground">Size {size} selected. Checkout is not part of this demo.</p>}
            </div>
            <ul className="mt-8 space-y-2 text-sm">
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
