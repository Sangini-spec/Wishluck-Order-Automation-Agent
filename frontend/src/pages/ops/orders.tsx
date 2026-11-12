import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { PackageSearch, Search, X } from 'lucide-react';
import { useGetOrders, useGetDashboard, getGetOrdersQueryKey } from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState, Empty, Panel } from '@/components/kit';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateTestOrder } from '@/components/test-order';
import { inr, when, human, arr } from '@/lib/format';

export default function Orders() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 280);
    return () => clearTimeout(t);
  }, [q]);
  const params = { ...(search ? { search } : {}), ...(status !== 'ALL' ? { status } : {}) };
  const { data, isLoading, error, refetch } = useGetOrders(params, { query: { queryKey: getGetOrdersQueryKey(params), placeholderData: (p) => p } });
  const { data: dash } = useGetDashboard();
  const statuses = dash?.orderStatuses.map((s) => s.name) ?? [];
  return (
    <>
      <PageHeader kicker="Ledger" title="Orders" sub="Search orders, review fulfillment and follow up with customers.">
        <CreateTestOrder />
      </PageHeader>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="input-search-orders" value={q} onChange={(e) => setQ(e.target.value)} placeholder="WL10239, Priya, 90000..." className="bg-card pl-9" />
          {q && <button data-testid="button-clear-search" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="select-status" className="bg-card sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{human(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading || !data ? <Rows n={8} /> : data.length === 0 ? (
        <Panel><Empty icon={<PackageSearch className="h-6 w-6" />} title="No orders match" body="Try a different ID, name or status filter." action={<button data-testid="button-reset-filters" onClick={() => { setQ(''); setStatus('ALL'); }} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Reset filters</button>} /></Panel>
      ) : (
        <Panel bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-secondary/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2.5">Order</th><th className="px-4">Customer</th><th className="px-4">Status</th><th className="px-4">Fulfilment</th><th className="px-4">Payment</th><th className="px-4">Placed</th><th className="px-4 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.map((o) => (
                  <tr key={o.id} data-testid={`row-order-${o.id}`} className="group hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link href={`/ops/orders/${o.id}`} data-testid={`link-order-${o.id}`} className="font-data font-medium text-indigo group-hover:underline">{o.id}</Link>
                      <div className="mt-0.5 flex gap-1">
                        {o.isDemo && <Pill value="Test order" t="indigo" />}
                        {o.scenarioTag && <span className="font-data text-[10px] text-muted-foreground">{o.scenarioTag}</span>}
                      </div>
                    </td>
                    <td className="px-4"><div>{o.customerName}</div><div className="font-data text-[11px] text-muted-foreground">{o.customerPhone ?? o.customerId}</div></td>
                    <td className="px-4"><Pill value={o.status} /></td>
                    <td className="px-4"><Pill value={o.fulfillmentStatus} /></td>
                    <td className="px-4 font-data text-xs">{o.paymentMethod}{o.paymentStatus ? ` · ${human(o.paymentStatus)}` : ''}</td>
                    <td className="px-4 text-xs text-muted-foreground">{when(o.createdAt)}</td>
                    <td className="px-4 text-right font-data">{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 font-data text-[11px] text-muted-foreground">{data.length} orders</div>
        </Panel>
      )}
    </>
  );
}
