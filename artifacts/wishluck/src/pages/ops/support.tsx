import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCheck, LifeBuoy, Loader2, Save, Send } from 'lucide-react';
import { useGetTickets, useUpdateTicket, useSendMessage, type Ticket } from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState, Empty, Panel } from '@/components/kit';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { ago, errMsg, human } from '@/lib/format';

function TicketCard({ t }: { t: Ticket }) {
  const [reply, setReply] = useState(t.suggestedReply);
  useEffect(() => setReply(t.suggestedReply), [t.id, t.suggestedReply]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const fail = (e: unknown) => toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
  const upd = useUpdateTicket({ mutation: { onSuccess: () => { invalidateData(qc); toast({ title: 'Ticket updated' }); }, onError: fail } });
  const send = useSendMessage({ mutation: { onSuccess: () => { invalidateData(qc); toast({ title: 'Reply sent as team', description: `Delivered into conversation ${t.conversationId}` }); }, onError: fail } });
  const dirty = reply !== t.suggestedReply;
  return (
    <article data-testid={`card-ticket-${t.id}`} className="rise rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="font-data text-xs text-muted-foreground">{t.id}</span>
        <Pill value={t.priority} /><Pill value={t.status} /><Pill value={`Sentiment ${t.sentiment}`} t={/neg|angry|frustr/i.test(t.sentiment) ? 'madder' : 'stone'} />
        <span className="ml-auto text-xs text-muted-foreground">{ago(t.createdAt)}</span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="font-display text-lg font-semibold">{t.customerName}</div>
          <div className="text-xs text-muted-foreground">{human(t.reason)}{t.orderId ? ` · ${t.orderId}` : ''}</div>
          <p className="mt-3 text-sm leading-relaxed">{t.summary}</p>
          <Link href={`/ops/inbox?c=${t.conversationId}`} data-testid={`link-ticket-conversation-${t.id}`} className="mt-3 inline-block text-sm text-indigo underline">Open conversation</Link>
        </div>
        <div>
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Suggested reply — editable</label>
          <Textarea data-testid={`input-reply-${t.id}`} value={reply} onChange={(e) => setReply(e.target.value)} rows={5} className="mt-1 bg-background" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button data-testid={`button-send-reply-${t.id}`} disabled={!reply.trim() || send.isPending} onClick={() => send.mutate({ id: t.conversationId, data: { content: reply.trim(), asHuman: true } })} className="inline-flex items-center gap-1.5 rounded-lg bg-madder px-3 py-1.5 text-sm text-paper disabled:opacity-50">
              {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Send as team
            </button>
            <button data-testid={`button-save-reply-${t.id}`} disabled={!dirty || upd.isPending} onClick={() => upd.mutate({ id: t.id, data: { suggestedReply: reply } })} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save draft</button>
            {t.status !== 'RESOLVED' ? (
              <button data-testid={`button-resolve-ticket-${t.id}`} disabled={upd.isPending} onClick={() => upd.mutate({ id: t.id, data: { status: 'RESOLVED' } })} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-leaf/40 bg-leaf/10 px-3 py-1.5 text-sm text-leaf"><CheckCheck className="h-3.5 w-3.5" />Resolve</button>
            ) : (
              <button data-testid={`button-reopen-ticket-${t.id}`} disabled={upd.isPending} onClick={() => upd.mutate({ id: t.id, data: { status: 'OPEN' } })} className="ml-auto rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Reopen</button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Support() {
  const { data, isLoading, error, refetch } = useGetTickets();
  const [f, setF] = useState('OPEN');
  const list = useMemo(() => (data ?? []).filter((t) => f === 'ALL' || t.status === f), [data, f]);
  return (
    <>
      <PageHeader kicker="Escalations" title="Support tickets" sub="Raised when the AI hands over. Edit the suggested reply, send it into the chat, then resolve.">
        <Tabs value={f} onValueChange={setF}><TabsList className="bg-secondary">
          {['OPEN', 'RESOLVED', 'ALL'].map((s) => <TabsTrigger key={s} value={s} data-testid={`filter-ticket-${s.toLowerCase()}`}>{human(s)} <span className="ml-1 font-data opacity-60">{(data ?? []).filter((t) => s === 'ALL' || t.status === s).length}</span></TabsTrigger>)}
        </TabsList></Tabs>
      </PageHeader>
      {error ? <ErrorState error={error} retry={refetch} /> : isLoading ? <Rows n={3} h="h-40" /> : list.length === 0 ? (
        <Panel><Empty icon={<LifeBuoy className="h-6 w-6" />} title={f === 'OPEN' ? 'No open escalations' : 'No tickets here'} body="Tickets appear when a conversation needs a human — a refund dispute, an angry customer, or a take-over from the inbox." action={<Link href="/ops/inbox" data-testid="link-empty-inbox" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Go to inbox</Link>} /></Panel>
      ) : <div className="space-y-4">{list.map((t) => <TicketCard key={t.id} t={t} />)}</div>}
    </>
  );
}
