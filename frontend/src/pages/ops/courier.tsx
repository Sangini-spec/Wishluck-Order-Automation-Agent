import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Truck, Zap } from 'lucide-react';
import { useGetOrders, useGetOrder, getGetOrderQueryKey, useTriggerCourier, CourierInputStatus, type CourierInputStatus as CS } from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState, Empty, Panel } from '@/components/kit';
import { ShipmentTimeline, Warnings } from '@/components/order-detail';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { arr, errMsg, human } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUSES = Object.values(CourierInputStatus) as CS[];
const REASONS = ['Customer not available', 'Address incomplete', 'Customer refused delivery', 'Phone unreachable', 'Rescheduled by customer'];

function Console({ id }: { id: string }) {
  const { data: o, isLoading, error, refetch } = useGetOrder(id, { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) } });
  const [status, setStatus] = useState<CS>('IN_TRANSIT');
  const [reason, setReason] = useState('');
  const [eventId, setEventId] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();
  const m = useTriggerCourier({
    mutation: {
      onSuccess: (r) => { invalidateData(qc); toast({ title: r.success ? 'Courier event recorded' : 'Event not applied', description: r.message, variant: r.success ? 'default' : 'destructive' }); },
      onError: (e) => toast({ title: 'Courier event failed', description: errMsg(e), variant: 'destructive' }),
    },
  });
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !o) return <Rows n={4} h="h-24" />;
  const needsReason = status === 'DELIVERY_FAILED' || status === 'RTO_INITIATED';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/ops/orders/${o.id}`} data-testid="link-courier-order" className="font-display text-2xl font-semibold text-indigo hover:underline">{o.id}</Link>
        <span className="text-sm text-muted-foreground">{o.customerName}</span><Pill value={o.fulfillmentStatus} />
      </div>
      <Warnings order={o} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Fire a courier webhook">
          <Label className="text-xs text-muted-foreground">Event status</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {STATUSES.map((s) => (
              <button key={s} data-testid={`button-status-${s.toLowerCase()}`} onClick={() => setStatus(s)} className={cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', status === s ? (/FAIL|RTO/.test(s) ? 'border-madder bg-madder/10' : 'border-indigo bg-accent') : 'hover:bg-accent/60')}>{human(s)}</button>
            ))}
          </div>
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground">Reason {needsReason ? '(recommended for NDR)' : '(optional)'}</Label>
            <Input data-testid="input-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" placeholder="Why did this happen" />
            {needsReason && <div className="mt-1.5 flex flex-wrap gap-1">{REASONS.map((r) => <button key={r} data-testid={`chip-reason-${r.split(' ')[0].toLowerCase()}`} onClick={() => setReason(r)} className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent">{r}</button>)}</div>}
          </div>
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground">Event ID (optional — reuse one to test idempotent replay)</Label>
            <Input data-testid="input-event-id" value={eventId} onChange={(e) => setEventId(e.target.value)} className="mt-1 font-data" placeholder="evt-..." />
          </div>
          <button data-testid="button-trigger-courier" disabled={m.isPending} onClick={() => m.mutate({ id: o.id, data: { status, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(eventId.trim() ? { eventId: eventId.trim() } : {}) } })}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60">
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-turmeric" />}Send {human(status)} event
          </button>
        </Panel>
        <Panel title="Shipment trail"><ShipmentTimeline shipments={o.shipments} /></Panel>
      </div>
    </div>
  );
}

export default function Courier() {
  const search = useSearch();
  const [, nav] = useLocation();
  const sel = new URLSearchParams(search).get('order') ?? '';
  const { data, isLoading, error, refetch } = useGetOrders();
  const [q, setQ] = useState('');
  const list = useMemo(() => (data ?? []).filter((o) => !q || `${o.id} ${o.customerName}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  return (
    <>
      <PageHeader kicker="Logistics simulator" title="Courier events" sub="Push courier webhooks into any order and watch NDR follow-ups, holds and RTO handling react." />
      {error ? <ErrorState error={error} retry={refetch} /> : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-testid="input-search-courier" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order or customer" className="bg-card pl-9" /></div>
            {isLoading ? <Rows n={6} /> : (
              <ul className="max-h-[70dvh] space-y-1 overflow-auto pr-1">
                {list.map((o) => {
                  const s = arr(o.shipments)[0];
                  return (
                    <li key={o.id}>
                      <button data-testid={`row-courier-${o.id}`} onClick={() => nav(`/ops/courier?order=${o.id}`)} className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left', sel === o.id ? 'border-indigo bg-card shadow-sm' : 'border-transparent hover:bg-card')}>
                        <Truck className={cn('h-4 w-4 shrink-0', s ? 'text-indigo' : 'text-muted-foreground')} />
                        <div className="min-w-0 flex-1"><div className="font-data text-sm">{o.id}</div><div className="truncate text-xs text-muted-foreground">{o.customerName}</div></div>
                        <Pill value={s ? s.status : o.fulfillmentStatus} />
                      </button>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="p-4 text-sm text-muted-foreground">No orders match.</li>}
              </ul>
            )}
          </div>
          <div>{sel ? <Console key={sel} id={sel} /> : <Panel><Empty icon={<Truck className="h-6 w-6" />} title="Select an order" body="Pick any order to inspect its shipment trail and send a simulated courier event." /></Panel>}</div>
        </div>
      )}
    </>
  );
}
