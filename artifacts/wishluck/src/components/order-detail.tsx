import { AlertTriangle, MapPin, PackageCheck, ShieldAlert } from 'lucide-react';
import type { Order } from '@workspace/api-client-react';
import { Panel, Pill, KV, JsonBlock } from '@/components/kit';
import { arr, rec, str, inr, when, human, num } from '@/lib/format';
import { cn } from '@/lib/utils';

export function addressLines(a: unknown) {
  const r = rec(a);
  return [r.line1, r.line2, r.landmark && `Near ${r.landmark}`, [r.city, r.state].filter(Boolean).join(', '), r.pincode, r.zone && `Zone ${r.zone}`]
    .filter(Boolean)
    .map(String);
}

export function Warnings({ order }: { order: Order }) {
  const w = arr(order.warnings);
  if (!w.length) return null;
  return (
    <div data-testid="list-warnings" className="rounded-xl border border-turmeric/50 bg-turmeric/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[hsl(32_80%_30%)]">
        <AlertTriangle className="h-3.5 w-3.5" /> Seed data warnings ({w.length})
      </div>
      <ul className="space-y-1 text-sm">
        {w.map((x, i) => (
          <li key={i} className="flex gap-2"><span className="font-data text-xs text-[hsl(32_80%_30%)]">{str(x.code)}</span><span>{str(x.detail)}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function RiskGauge({ risk }: { risk: unknown }) {
  const r = rec(risk);
  const score = num(r.score);
  const reasons = Array.isArray(r.reasons) ? r.reasons.map((x) => str(x)) : [];
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Risk score</div>
          <div className="font-display text-4xl font-semibold tabular-nums">{score ?? '—'}<span className="text-base text-muted-foreground">/100</span></div>
        </div>
        {r.band !== undefined && <Pill value={r.band} testId="status-risk-band" />}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gradient-to-r from-leaf/25 via-turmeric/35 to-madder/40">
        <div className="relative h-full" style={{ width: `${Math.min(100, Math.max(0, score ?? 0))}%` }}>
          <span className="absolute -right-1 -top-1 h-4 w-1.5 rounded-full bg-foreground" />
        </div>
      </div>
      {r.eligible !== undefined && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Pill value={r.eligible ? 'COD eligible' : 'COD not eligible'} t={r.eligible ? 'leaf' : 'madder'} />
          {!!r.eligibilityReason && <span className="text-muted-foreground">{str(r.eligibilityReason)}</span>}
        </div>
      )}
      {reasons.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {reasons.map((x, i) => (
            <li key={i} className="flex gap-2 text-sm"><span className="font-data text-xs text-madder">{String(i + 1).padStart(2, '0')}</span>{x}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ShipmentTimeline({ shipments }: { shipments: unknown }) {
  const list = arr(shipments);
  if (!list.length) return <p className="text-sm text-muted-foreground">No shipment created for this order yet.</p>;
  return (
    <div className="space-y-5">
      {list.map((s) => {
        const ev = arr(s.events);
        return (
          <div key={str(s.id)}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-data text-xs">{str(s.id)}</span>
              <Pill value={s.status} />
              <span className="text-xs text-muted-foreground">Attempts {str(s.attemptCount, '0')} · ETA {when(s.estimatedDeliveryDate)}</span>
              {!!s.trackingUrl && <a data-testid={`link-tracking-${str(s.id)}`} href={String(s.trackingUrl)} target="_blank" rel="noreferrer" className="text-xs text-indigo underline">Tracking</a>}
            </div>
            <ol className="relative mt-3 ml-1.5 border-l border-dashed border-indigo/30 pl-4">
              {ev.length === 0 && <li className="text-sm text-muted-foreground">No courier events recorded.</li>}
              {ev.map((e) => (
                <li key={str(e.id)} className="relative pb-3 last:pb-0">
                  <span className={cn('absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card', /FAIL|RTO/.test(str(e.status)) ? 'bg-madder' : /DELIVERED/.test(str(e.status)) ? 'bg-leaf' : 'bg-indigo')} />
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-sm font-medium">{human(e.status)}</span>
                    <span className="font-data text-[11px] text-muted-foreground">{when(e.occurredAt)}</span>
                  </div>
                  {!!e.reason && <div className="text-xs text-muted-foreground">{str(e.reason)}</div>}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

export function OrderDetail({ order, compact }: { order: Order; compact?: boolean }) {
  const pay = rec(order.payment);
  const cod = rec(order.cod);
  const items = arr(order.items);
  const returns = arr(order.returns);
  const refunds = arr(order.refunds);
  const audit = arr(order.audit);
  return (
    <div className="space-y-4">
      <Warnings order={order} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title="Items">
            <div className="divide-y">
              {items.map((it, i) => (
                <div key={str(it.id, String(i))} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{str(it.productName)}</div>
                    <div className="font-data text-[11px] text-muted-foreground">{str(it.sku)} · size {str(it.size)} · qty {str(it.quantity)}</div>
                  </div>
                  <div className="font-data text-sm">{inr(it.unitPrice)}</div>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-muted-foreground">No line items recorded.</p>}
            </div>
          </Panel>
          <Panel title="Shipments"><ShipmentTimeline shipments={order.shipments} /></Panel>
          <Panel title="Returns and refunds">
            {returns.length === 0 && refunds.length === 0 && <p className="text-sm text-muted-foreground">No return or refund records.</p>}
            {returns.map((r, i) => (
              <div key={i} className="mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>Return {str(r.id, '')}</span>
                {str(r.status, '').toUpperCase() === 'NONE' ? <span className="text-xs text-muted-foreground">Not requested — no return submitted</span> : <Pill value={r.status} />}
              </div>
            ))}
            {refunds.map((r, i) => (
              <div key={`rf${i}`} className="mb-2 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>Refund {str(r.id, '')} · {inr(r.amount)}</span><Pill value={r.status} />
              </div>
            ))}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Payment" action={<Pill value={order.paymentStatus ?? pay.status} />}>
            <KV k="Method" v={str(pay.method ?? order.paymentMethod)} />
            <KV k="Subtotal" v={inr(pay.subtotal)} mono />
            <KV k="Shipping" v={inr(pay.shippingFee)} mono />
            <KV k="COD fee" v={inr(pay.codFee)} mono />
            <KV k="Discount" v={inr(pay.discount)} mono />
            <div className="rule-dotted my-1" />
            <KV k="Total" v={inr(pay.total ?? order.total)} mono />
            <KV k="Due at delivery" v={inr(pay.amountDueAtDelivery)} mono />
          </Panel>
          {order.cod && Object.keys(cod).length > 0 && (
            <Panel title="COD confirmation" action={<Pill value={cod.status} />}>
              <KV k="Message sent" v={when(cod.messageSentAt)} />
              <KV k="Reminder sent" v={when(cod.reminderSentAt)} />
              <KV k="Held at" v={when(cod.heldAt)} />
            </Panel>
          )}
          {order.risk && <Panel title={<span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-madder" />Risk assessment</span>}><RiskGauge risk={order.risk} /></Panel>}
          <Panel title={<span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo" />Ship to</span>}>
            <div className="text-sm leading-relaxed">{addressLines(order.shippingAddress).map((l, i) => <div key={i}>{l}</div>)}</div>
          </Panel>
          {!!order.notes?.length && (
            <Panel title="Notes"><ul className="list-disc space-y-1 pl-4 text-sm">{order.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></Panel>
          )}
        </div>
      </div>
      {!compact && audit.length > 0 && (
        <Panel title={<span className="flex items-center gap-2"><PackageCheck className="h-4 w-4" />Audit trail</span>}>
          <ol className="space-y-2">
            {audit.map((a, i) => (
              <li key={i} className="grid gap-1 text-sm md:grid-cols-[170px_1fr]">
                <span className="font-data text-[11px] text-muted-foreground">{when(a.createdAt ?? a.at)}</span>
                <div><span className="font-medium">{human(a.action ?? a.type)}</span>{a.detail !== undefined && <div className="mt-1"><JsonBlock value={a.detail} label="Detail" /></div>}</div>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
