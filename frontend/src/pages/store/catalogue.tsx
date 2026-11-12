import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, Shirt } from 'lucide-react';
import { useGetProducts } from '@workspace/api-client-react';
import { ProductImage } from '@/components/product-image';
import { Rows, ErrorState, Empty } from '@/components/kit';
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
          <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Wishluck Store · Everyday edit</div>
          <h1 className="font-display mt-2 text-5xl font-semibold leading-[0.95] md:text-6xl">Six pieces,<br /><em className="font-normal text-indigo">for every day.</em></h1>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>A small, focused range: a kurta, tees, jeans, innerwear and a tote. Pick a size to see live stock, add it to your bag and check out with cash on delivery or online payment.</p>
          <p className="font-data text-[11px] uppercase tracking-wider">Return and exchange rules are shown on every product.</p>
        </div>
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
                <div className="relative overflow-hidden rounded-xl border bg-secondary shadow-[0_1px_0_hsl(var(--border)),0_12px_30px_-18px_hsl(232_58%_30%/.35)]">
                  <ProductImage sku={p.sku} name={p.name} eager={i < 4} className="aspect-[5/6] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                  {stock === 0 && <span className="absolute left-2 top-2 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] uppercase tracking-wider text-background">Sold out</span>}
                  {!p.returnable && <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground">{p.exchangeable ? 'Size exchange only' : 'No returns'}</span>}
                  {stock > 0 && stock <= 5 && <span className="absolute bottom-2 left-2 rounded-full bg-turmeric px-2 py-0.5 font-data text-[10px] text-indigo">{stock} left</span>}
                </div>
                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate text-sm font-medium group-hover:text-indigo">{p.name}</div><div className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">{p.category} · {p.sizes.length} size{p.sizes.length === 1 ? '' : 's'}</div></div>
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
