import { Link } from 'wouter';
import { ArrowUpRight, Clock } from 'lucide-react';
import { useGetDashboard } from '@workspace/api-client-react';
import { PageHeader, Metric, Panel, Pill, Rows, ErrorState } from '@/components/kit';
import { rec, num, pct, secs, when, ago, human, inr } from '@/lib/format';
import { cn } from '@/lib/utils';

function Bars({ data, colorFor }: { data: { name: string; count: number }[]; colorFor?: (n: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.name}>
          <div className="mb-1 flex justify-between text-xs"><span>{human(d.name)}</span><span className="font-data">{d.count}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full transition-[width] duration-700', colorFor?.(d.name) ?? 'bg-indigo')} style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
export { Bars };

export default function Overview() {
  const { data, isLoading, error, refetch } = useGetDashboard();
  if (error) return <ErrorState error={error} retry={refetch} />;
  const m = rec(data?.metrics);
  const n = (k: string) => num(m[k]) ?? '—';
  return (
    <>
      <PageHeader kicker="Desk overview" title="Today on the floor" sub={data ? <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Demo clock {when(data.demoClock)}</span> : 'Loading the ledger'} />
      {isLoading || !data ? (
        <Rows n={6} h="h-20" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="Orders" value={n('totalOrders')} hint={`${n('totalCustomers')} customers`} testId="metric-orders" />
            <Metric label="Active chats" value={n('activeConversations')} accent="indigo" testId="metric-active" />
            <Metric label="Needs human" value={n('needsHuman')} accent="madder" testId="metric-needs-human" />
            <Metric label="Pending COD" value={n('pendingCod')} hint={`${n('highRiskCod')} high risk`} accent="turmeric" testId="metric-pending-cod" />
            <Metric label="Failed deliveries" value={n('failedDeliveries')} hint={`${n('onHold')} on hold`} accent="madder" testId="metric-failed" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="AI resolution rate" value={pct(m.aiResolutionRate)} hint="Customer-confirmed, no human step-in" accent="leaf" testId="metric-ai-rate" />
            <Metric label="First response" value={secs(m.firstResponseSeconds)} accent="leaf" testId="metric-first-response" />
            <Link href="/ops/inbox" data-testid="link-go-inbox" className="flex items-center justify-between rounded-xl border bg-indigo p-4 text-paper hover:-translate-y-0.5 transition-transform"><span className="font-display text-lg">Open inbox</span><ArrowUpRight className="h-5 w-5 text-turmeric" /></Link>
            <Link href="/ops/cod" data-testid="link-go-cod" className="flex items-center justify-between rounded-xl border bg-card p-4 hover:-translate-y-0.5 transition-transform"><span className="font-display text-lg">Review COD risk</span><ArrowUpRight className="h-5 w-5 text-madder" /></Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Order statuses"><Bars data={data.orderStatuses} /></Panel>
            <Panel title="COD risk bands"><Bars data={data.riskBands} colorFor={(x) => (/HIGH/i.test(x) ? 'bg-madder' : /MED/i.test(x) ? 'bg-turmeric' : 'bg-leaf')} /></Panel>
            <Panel title="Latest activity" action={<Link href="/ops/activity" data-testid="link-all-activity" className="text-xs text-indigo underline">All</Link>} bodyClass="p-0">
              <ul className="max-h-72 divide-y overflow-auto">
                {data.activity.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nothing has happened yet — start a conversation or trigger a courier event.</li>}
                {data.activity.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0"><div className="truncate font-medium">{human(a.action)}</div><div className="font-data text-[11px] text-muted-foreground">{a.type}{a.orderId ? ` · ${a.orderId}` : ''}</div></div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{ago(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <Panel title="Recent orders" bodyClass="p-0" action={<Link href="/ops/orders" data-testid="link-all-orders" className="text-xs text-indigo underline">All orders</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-accent/40">
                      <td className="px-4 py-2.5"><Link href={`/ops/orders/${o.id}`} data-testid={`link-order-${o.id}`} className="font-data font-medium text-indigo">{o.id}</Link></td>
                      <td className="px-4 py-2.5">{o.customerName}</td>
                      <td className="px-4 py-2.5"><Pill value={o.status} /></td>
                      <td className="px-4 py-2.5 font-data text-xs">{o.paymentMethod}</td>
                      <td className="px-4 py-2.5 text-right font-data">{inr(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
