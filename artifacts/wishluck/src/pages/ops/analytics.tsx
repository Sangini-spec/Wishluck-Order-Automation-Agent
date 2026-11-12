import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGetAnalytics, type Breakdown } from '@workspace/api-client-react';
import { PageHeader, Metric, Panel, Rows, ErrorState } from '@/components/kit';
import { rec, num, pct, secs, inr, human } from '@/lib/format';

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
  return (
    <>
      <PageHeader kicker="Measured, not modelled" title="Analytics" sub="Computed from real conversations, tool calls and order events in this environment." />
      {isLoading || !data ? <Rows n={5} h="h-24" /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric label="Conversations" value={num(m.conversations) ?? '—'} hint={`${num(m.resolved) ?? 0} resolved`} testId="metric-conversations" />
            <Metric label="AI resolution" value={pct(m.aiResolutionRate)} accent="leaf" testId="metric-ai-resolution" />
            <Metric label="COD confirmation" value={pct(m.codConfirmationRate)} accent="turmeric" testId="metric-cod-confirmation" />
            <Metric label="RTO saved" value={num(m.rtoSaved) !== null && num(m.rtoSaved)! > 100 ? inr(m.rtoSaved) : (num(m.rtoSaved) ?? '—')} accent="leaf" testId="metric-rto-saved" />
            <Metric label="First response" value={secs(m.firstResponseSeconds)} testId="metric-first-response" />
            <Metric label="Tool success" value={pct(m.toolSuccessRate)} accent="indigo" testId="metric-tool-success" />
            <Metric label="Avg response" value={num(m.averageResponseMs) !== null ? `${Math.round(num(m.averageResponseMs)!)}ms` : '—'} testId="metric-avg-response" />
            <Metric label="LLM cost" value={m.llmCost === null || m.llmCost === undefined ? 'Unavailable' : `$${num(m.llmCost)?.toFixed(4)}`} hint={m.llmCost == null ? 'Not reported by the model provider' : undefined} accent="stone" testId="metric-llm-cost" />
          </div>
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
