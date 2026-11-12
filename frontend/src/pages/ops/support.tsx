import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, LifeBuoy } from 'lucide-react';
import { useGetTickets } from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState, Empty, Panel } from '@/components/kit';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ago, human } from '@/lib/format';

export default function Support() {
  const { data, isLoading, error, refetch } = useGetTickets();
  const [f, setF] = useState('OPEN');
  const list = useMemo(() => (data ?? []).filter((t) => f === 'ALL' || t.status === f), [data, f]);
  return (
    <>
      <PageHeader kicker="Escalations" title="Support tickets" sub="A record of every handover from the AI to a person. Replies, drafts and resolution all happen in the Inbox thread.">
        <Tabs value={f} onValueChange={setF}><TabsList className="bg-secondary">
          {['OPEN', 'RESOLVED', 'ALL'].map((s) => <TabsTrigger key={s} value={s} data-testid={`filter-ticket-${s.toLowerCase()}`}>{human(s)} <span className="ml-1 font-data opacity-60">{(data ?? []).filter((t) => s === 'ALL' || t.status === s).length}</span></TabsTrigger>)}
        </TabsList></Tabs>
      </PageHeader>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={5} h="h-14" /> : list.length === 0 ? (
        <Panel><Empty icon={<LifeBuoy className="h-6 w-6" />} title={f === 'OPEN' ? 'No open escalations' : 'No tickets here'} body="Tickets appear when a conversation needs a human: a refund dispute, an upset customer, or a take-over from the inbox." action={<Link href="/ops/inbox" data-testid="link-empty-inbox" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Go to inbox</Link>} /></Panel>
      ) : (
        <Panel bodyClass="p-0">
          <ul className="divide-y">
            {list.map((t) => (
              <li key={t.id} data-testid={`row-ticket-${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <span data-testid={`text-ticket-customer-${t.id}`} className="font-medium">{t.customerName}</span>
                    <span className="break-all font-data text-[11px] text-muted-foreground">{t.id}{t.orderId ? ` · ${t.orderId}` : ''}</span>
                  </div>
                  <div data-testid={`text-ticket-reason-${t.id}`} className="break-words text-sm text-muted-foreground">{human(t.reason)}</div>
                </div>
                <div className="flex items-center gap-1.5"><Pill value={t.priority} /><Pill value={t.status} /></div>
                <span className="text-xs text-muted-foreground">{ago(t.createdAt)}</span>
                <Link href={`/ops/inbox?c=${t.conversationId}`} data-testid={`link-ticket-conversation-${t.id}`} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-sm text-indigo hover:bg-accent">Open conversation<ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
