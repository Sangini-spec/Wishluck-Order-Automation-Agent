import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGetAnalytics, type Breakdown } from '@workspace/api-client-react';
import { PageHeader, Metric, Panel, Rows, ErrorState } from '@/components/kit';
import { rec, num, pct, secs, str, when, human } from '@/lib/format';
import { ExternalLink } from 'lucide-react';

function Chart({ data, color }: { data: Breakdown[]; color: string }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No data recorded yet. Run a few conversations to populate this.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data.map((d) => ({ ...d, label: human(d.name) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="hsl(36 22% 86%)" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="hsl(230 12% 50%)" />
        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12 }} stroke="hsl(230 12% 50%)" />
        <Tooltip cursor={{ fill: 'hsl(232 40% 92% / .6)' }} contentStyle={{ borderRadius: 10, border: '1px solid hsl(36 22% 84%)', background: 'hsl(42 45% 98%)' }} />
        <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Analytics() {
  const { data, isLoading, error, refetch } = useGetAnalytics();
  if (error) return <ErrorState error={error} retry={refetch} />;
  const m = rec(data?.metrics);
  const defs = Object.entries(rec(data?.definitions));
  const rc = rec(data?.rateCard);
  const assumptions = Array.isArray(rc.assumptions) ? rc.assumptions.map((x) => str(x)) : rc.assumptions ? [str(rc.assumptions)] : [];
  const cost = num(m.llmCost);
  return (
    <>
      <PageHeader kicker="Measured, not modelled" title="Analytics" sub="Computed from real conversations, tool calls and order events in this environment." />
      {isLoading || !data ? <Rows n={5} h="h-24" /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric label="Conversations" value={num(m.conversations) ?? '—'} hint={`${num(m.resolved) ?? 0} resolved`} testId="metric-conversations" />
            <Metric label="AI resolution" value={pct(m.aiResolutionRate)} hint={`${num(m.aiResolved) ?? 0} customer-confirmed of ${num(m.customerChats) ?? 0} chats`} accent="leaf" testId="metric-ai-resolution" />
            <Metric label="COD confirmation" value={pct(m.codConfirmationRate)} accent="turmeric" testId="metric-cod-confirmation" />
            <Metric label="RTO saved" value={num(m.rtoSaved) ?? '—'} hint="Distinct live orders" accent="leaf" testId="metric-rto-saved" />
            <Metric label="First response" value={secs(m.firstResponseSeconds)} testId="metric-first-response" />
            <Metric label="Tool success" value={pct(m.toolSuccessRate)} accent="indigo" testId="metric-tool-success" />
            <Metric label="Avg response" value={num(m.averageResponseMs) !== null ? `${Math.round(num(m.averageResponseMs)!)}ms` : '—'} testId="metric-avg-response" />
            <Metric label="Estimated LLM cost" value={cost === null ? 'Unavailable' : `~$${cost.toFixed(4)}`} hint={cost === null ? 'No token usage recorded' : 'USD at public token rates — not your Replit bill'} accent="stone" testId="metric-llm-cost" />
          </div>
          <Panel title="How these numbers are defined">
            {defs.length === 0 ? <p className="text-sm text-muted-foreground">AI resolution counts customer-confirmed AI resolutions with no ticket or human step-in, divided by conversations with at least one customer message. RTO saved counts distinct live orders.</p> : (
              <dl data-testid="list-metric-definitions" className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                {defs.map(([k, v]) => <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{human(k.replace(/([A-Z])/g, '_$1'))}</dt><dd className="mt-0.5 text-sm">{str(v)}</dd></div>)}
              </dl>
            )}
            <div data-testid="text-rate-card" className="mt-4 rounded-lg border border-dashed bg-secondary/40 p-3 text-xs leading-relaxed">
              <div className="font-medium">Estimated LLM cost is an estimate, not a bill.</div>
              <p className="text-muted-foreground">Calculated in USD from recorded token counts and published per-token prices. It is not your actual Replit credit usage.{rc.model ? ` Model: ${str(rc.model)}.` : ''}{rc.verifiedAt ? ` Rates checked ${when(rc.verifiedAt)}.` : ''}</p>
              {assumptions.length > 0 && <ul className="mt-1 list-disc pl-4 text-muted-foreground">{assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
              {typeof rc.source === 'string' && /^https?:\/\//.test(rc.source) && <a data-testid="link-rate-source" href={rc.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-indigo underline">Rate source<ExternalLink className="h-3 w-3" /></a>}
            </div>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Customer intents"><Chart data={data.intents} color="hsl(232 58% 34%)" /></Panel>
            <Panel title="Handover reasons"><Chart data={data.handovers} color="hsl(356 64% 46%)" /></Panel>
          </div>
          <Panel title="Order status distribution"><Chart data={data.orderStatuses} color="hsl(40 85% 50%)" /></Panel>
        </div>
      )}
    </>
  );
}
