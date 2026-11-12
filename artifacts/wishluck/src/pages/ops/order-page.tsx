import { Link, useParams } from 'wouter';
import { ArrowLeft, Banknote, Truck } from 'lucide-react';
import { useGetOrder, getGetOrderQueryKey } from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState } from '@/components/kit';
import { OrderDetail } from '@/components/order-detail';
import { when, inr } from '@/lib/format';

export default function OrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: o, isLoading, error, refetch } = useGetOrder(id, { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) } });
  return (
    <>
      <Link href="/ops/orders" data-testid="link-back-orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All orders</Link>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading || !o ? <Rows n={6} h="h-24" /> : (
        <>
          <PageHeader kicker={`${o.customerName} · ${o.customerId}`} title={o.id} sub={<>Placed {when(o.createdAt)}{o.deliveredAt ? ` · delivered ${when(o.deliveredAt)}` : ''} · {inr(o.total)}</>}>
            <Pill value={o.status} /><Pill value={o.fulfillmentStatus} />
            {o.paymentMethod === 'COD' && <Link href={`/ops/cod?order=${o.id}`} data-testid="link-order-cod" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent"><Banknote className="h-4 w-4" />COD workflow</Link>}
            <Link href={`/ops/courier?order=${o.id}`} data-testid="link-order-courier" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent"><Truck className="h-4 w-4" />Courier events</Link>
          </PageHeader>
          <OrderDetail order={o} />
        </>
      )}
    </>
  );
}
