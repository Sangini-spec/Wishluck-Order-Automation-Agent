import { useState } from 'react';
import { Link } from 'wouter';
import { ChevronDown, Receipt } from 'lucide-react';
import { useGetOrders } from '@workspace/api-client-react';
import { Pill, Rows, ErrorState, Empty } from '@/components/kit';
import { OrderDetail } from '@/components/order-detail';
import { arr, inr, when, str } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function MyOrders() {
  const { data, isLoading, error, refetch } = useGetOrders();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className="rise mb-8">
        <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Your history</div>
        <h1 className="font-display mt-2 text-4xl font-semibold">My orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Need help with one? Open the chat and share the order ID with your phone number.</p>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={4} h="h-20" /> : !data?.length ? (
        <Empty icon={<Receipt className="h-6 w-6" />} title="No orders yet" body="This identity has no orders in the dataset." action={<Link href="/store" data-testid="link-shop" className="rounded-lg bg-indigo px-3 py-1.5 text-sm text-paper">Browse the shop</Link>} />
      ) : (
        <ul className="space-y-3">
          {data.map((o) => {
            const items = arr(o.items);
            const isOpen = open === o.id;
            return (
              <li key={o.id} className="overflow-hidden rounded-xl border bg-card">
                <button data-testid={`row-my-order-${o.id}`} onClick={() => setOpen(isOpen ? null : o.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-left hover:bg-accent/30">
                  <span className="font-data font-medium text-indigo">{o.id}</span>
                  <span className="text-sm text-muted-foreground">{when(o.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{items.map((i) => str(i.productName)).join(', ')}</span>
                  <Pill value={o.status} /><span className="font-data text-sm">{inr(o.total)}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && <div className="border-t bg-background/60 p-4"><OrderDetail order={o} compact /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
