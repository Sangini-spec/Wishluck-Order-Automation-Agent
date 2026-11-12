import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ScrollText, Search } from 'lucide-react';
import { useGetActivity } from '@workspace/api-client-react';
import { PageHeader, Rows, ErrorState, Empty, Panel, JsonBlock, Pill } from '@/components/kit';
import { Input } from '@/components/ui/input';
import { when, human } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function ActivityPage() {
  const { data, isLoading, error, refetch } = useGetActivity();
  const [type, setType] = useState('ALL');
  const [q, setQ] = useState('');
  const types = useMemo(() => Array.from(new Set((data ?? []).map((a) => a.type))), [data]);
  const list = useMemo(() => (data ?? []).filter((a) => (type === 'ALL' || a.type === type) &&
    (!q || `${a.action} ${a.orderId ?? ''} ${a.conversationId ?? ''} ${JSON.stringify(a.detail ?? {})}`.toLowerCase().includes(q.toLowerCase()))), [data, type, q]);
  return (
    <>
      <PageHeader kicker="Audit trace" title="Activity" sub="Every tool call, state change and simulated event, in order. Expand any row for the raw record." />
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-testid="input-search-activity" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action, order, conversation" className="bg-card pl-9" /></div>
        <div className="flex flex-wrap gap-1">
          {['ALL', ...types].map((t) => <button key={t} data-testid={`filter-activity-${t.toLowerCase()}`} onClick={() => setType(t)} className={cn('rounded-full border px-2.5 py-1 text-xs', type === t ? 'border-indigo bg-indigo text-paper' : 'bg-card hover:bg-accent')}>{t === 'ALL' ? 'All types' : human(t)}</button>)}
        </div>
      </div>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={10} /> : list.length === 0 ? (
        <Panel><Empty icon={<ScrollText className="h-6 w-6" />} title={data?.length ? 'No matching entries' : 'The trace is empty'} body={data?.length ? 'Adjust the search or type filter.' : 'Actions appear here as soon as the agent or the team does something.'} /></Panel>
      ) : (
        <Panel bodyClass="p-0">
          <ol className="divide-y">
            {list.map((a) => (
              <li key={a.id} data-testid={`row-activity-${a.id}`} className="grid gap-2 px-4 py-3 md:grid-cols-[160px_150px_1fr]">
                <span className="font-data text-[11px] text-muted-foreground">{when(a.createdAt)}</span>
                <span><Pill value={a.type} /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{human(a.action)}</span>
                    {a.orderId && <Link href={`/ops/orders/${a.orderId}`} data-testid={`link-activity-order-${a.id}`} className="font-data text-xs text-indigo underline">{a.orderId}</Link>}
                    {a.conversationId && <Link href={`/ops/inbox?c=${a.conversationId}`} data-testid={`link-activity-conv-${a.id}`} className="font-data text-xs text-indigo underline">chat</Link>}
                  </div>
                  {a.detail && Object.keys(a.detail).length > 0 && <div className="mt-1.5"><JsonBlock value={a.detail} label="Detail" /></div>}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </>
  );
}
