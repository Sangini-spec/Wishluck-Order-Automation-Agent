import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, Shirt } from 'lucide-react';
import { useGetProducts } from '@workspace/api-client-react';
import { Motif, Rows, ErrorState, Empty } from '@/components/kit';
import { Input } from '@/components/ui/input';
import { inr } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Catalogue() {
  const { data, isLoading, error, refetch } = useGetProducts();
  const [cat, setCat] = useState('ALL');
  const [q, setQ] = useState('');
  const cats = useMemo(() => Array.from(new Set((data ?? []).map((p) => p.category))), [data]);
  const list = (data ?? []).filter((p) => (cat === 'ALL' || p.category === cat) && (!q || `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <section className="rise mb-10 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div>
          <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Season of indigo</div>
          <h1 className="font-display mt-2 text-5xl font-semibold leading-[0.95] md:text-6xl">Printed by hand,<br /><em className="font-normal text-indigo">worn every day.</em></h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">Kurtas, co-ords and dupattas in dabu and block print. This storefront is browse-only in the demo — use the help chat to ask about your existing orders.</p>
      </section>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {['ALL', ...cats].map((c) => <button key={c} data-testid={`filter-category-${c.toLowerCase()}`} onClick={() => setCat(c)} className={cn('rounded-full border px-3 py-1 text-sm transition-colors', cat === c ? 'border-indigo bg-indigo text-paper' : 'bg-card hover:bg-accent')}>{c === 'ALL' ? 'Everything' : c}</button>)}
        </div>
        <div className="relative md:ml-auto md:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-testid="input-search-products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search styles" className="bg-card pl-9" /></div>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={3} h="h-64" /> : list.length === 0 ? (
        <Empty icon={<Shirt className="h-6 w-6" />} title="Nothing on this rail" body="Try another category or search term." />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p, i) => {
            const stock = p.inventory.reduce((s, x) => s + x.available, 0);
            return (
              <Link key={p.sku} href={`/store/product/${p.sku}`} data-testid={`card-product-${p.sku}`} className="rise group block" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <div className="relative overflow-hidden rounded-xl border bg-secondary">
                  <Motif seed={p.sku} label={p.name} className="aspect-[5/6] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                  {stock === 0 && <span className="absolute left-2 top-2 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] uppercase tracking-wider text-background">Sold out</span>}
                  {!p.returnable && <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground">Final sale</span>}
                </div>
                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate text-sm font-medium group-hover:text-indigo">{p.name}</div><div className="text-xs text-muted-foreground">{p.category}</div></div>
                  <div className="font-data text-sm">{inr(p.price)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
