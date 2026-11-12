import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Hand, Loader2, MessageSquarePlus, MessagesSquare, RotateCcw, Search, Send, ShieldCheck, ShieldQuestion, CheckCheck } from 'lucide-react';
import {
  useGetConversations, useGetConversation, getGetConversationQueryKey, useCreateConversation, useUpdateConversation,
  useSendMessage, useGetCustomers, type ConversationUpdateAction,
} from '@workspace/api-client-react';
import { PageHeader, Pill, Rows, ErrorState, Empty, Panel, KV } from '@/components/kit';
import { MessageList, ToolTrace, PendingAction } from '@/components/convo';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { ago, errMsg, human } from '@/lib/format';
import { cn } from '@/lib/utils';

const FILTERS = ['ALL', 'AI_HANDLING', 'NEEDS_HUMAN', 'RESOLVED'];

function StartDialog({ open, setOpen, onCreated }: { open: boolean; setOpen: (b: boolean) => void; onCreated: (id: string) => void }) {
  const [cid, setCid] = useState('');
  const { data: customers } = useGetCustomers();
  const qc = useQueryClient();
  const { toast } = useToast();
  const m = useCreateConversation({
    mutation: {
      onSuccess: (c) => { invalidateData(qc); setOpen(false); onCreated(c.id); },
      onError: (e) => toast({ title: 'Could not start conversation', description: errMsg(e), variant: 'destructive' }),
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Start a test conversation</DialogTitle>
          <DialogDescription>Opens a chat on behalf of a seeded customer. You can then type as that customer to drive the AI, or reply as the team.</DialogDescription>
        </DialogHeader>
        <Select value={cid} onValueChange={setCid}>
          <SelectTrigger data-testid="select-conversation-customer"><SelectValue placeholder="Choose customer" /></SelectTrigger>
          <SelectContent>{customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.id} · {c.name} · {c.phone}</SelectItem>)}</SelectContent>
        </Select>
        <button data-testid="button-start-conversation" disabled={!cid || m.isPending} onClick={() => m.mutate({ data: { customerId: cid } })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Start conversation
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Thread({ id }: { id: string }) {
  const { data: c, isLoading, error, refetch } = useGetConversation(id, { query: { enabled: !!id, queryKey: getGetConversationQueryKey(id) } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [asHuman, setAsHuman] = useState(true);
  const fail = (e: unknown) => toast({ title: 'Action failed', description: errMsg(e), variant: 'destructive' });
  const upd = useUpdateConversation({ mutation: { onSuccess: () => invalidateData(qc), onError: fail } });
  const send = useSendMessage({
    mutation: {
      onSuccess: (conv) => { qc.setQueryData(getGetConversationQueryKey(id), conv); setText(''); invalidateData(qc); },
      onError: fail,
    },
  });
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !c) return <Rows n={5} h="h-16" />;
  const act = (a: ConversationUpdateAction) => upd.mutate({ id, data: { action: a } });
  const submit = () => text.trim() && send.mutate({ id, data: { content: text.trim(), asHuman } });
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Panel bodyClass="p-0" className="flex min-h-[560px] flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold">{c.customerName}</div>
            <div className="font-data text-[11px] text-muted-foreground">{c.customerId} · {c.customerPhone ?? 'phone hidden'} · {c.language}</div>
          </div>
          <Pill value={c.status} testId="status-conversation" />
          <div className="ml-auto flex flex-wrap gap-1.5">
            {c.status !== 'NEEDS_HUMAN' && c.status !== 'RESOLVED' && <button data-testid="button-take-over" disabled={upd.isPending} onClick={() => act('TAKE_OVER')} className="inline-flex items-center gap-1.5 rounded-lg bg-madder px-3 py-1.5 text-sm text-paper disabled:opacity-60"><Hand className="h-3.5 w-3.5" />Take over</button>}
            {c.status === 'NEEDS_HUMAN' && <button data-testid="button-hand-back" disabled={upd.isPending} onClick={() => act('HAND_BACK')} className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"><RotateCcw className="h-3.5 w-3.5" />Hand back to AI</button>}
            {c.status !== 'RESOLVED' && <button data-testid="button-resolve" disabled={upd.isPending} onClick={() => act('RESOLVE')} className="inline-flex items-center gap-1.5 rounded-lg border border-leaf/40 bg-leaf/10 px-3 py-1.5 text-sm text-leaf disabled:opacity-60"><CheckCheck className="h-3.5 w-3.5" />Resolve</button>}
          </div>
        </div>
        {c.handoverReason && <div className="border-b bg-madder/5 px-4 py-2 text-sm"><span className="font-medium text-madder">Handover reason:</span> {c.handoverReason}</div>}
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(hsl(36_22%_84%/.5)_1px,transparent_1px)] [background-size:16px_16px] px-4 py-4" style={{ maxHeight: 520 }}>
          {c.messages.length === 0 ? <Empty icon={<MessagesSquare className="h-6 w-6" />} title="Quiet thread" body="Type as the customer below to see how the assistant responds and which tools it calls." /> : <MessageList messages={c.messages} perspective="team" />}
        </div>
        <div className="border-t p-3">
          <div className="mb-2 inline-flex rounded-lg border bg-secondary/50 p-0.5 text-xs">
            <button data-testid="toggle-as-human" onClick={() => setAsHuman(true)} className={cn('rounded-md px-3 py-1', asHuman && 'bg-card font-medium shadow-sm')}>Reply as team</button>
            <button data-testid="toggle-as-customer" onClick={() => setAsHuman(false)} className={cn('rounded-md px-3 py-1', !asHuman && 'bg-card font-medium shadow-sm')}>Simulate customer</button>
          </div>
          <div className="flex gap-2">
            <Textarea data-testid="input-message" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={asHuman ? 'Write a manual reply to the customer' : 'Type what the customer says, e.g. "Where is WL10239?"'} className="min-h-0 resize-none bg-card" />
            <button data-testid="button-send-message" disabled={!text.trim() || send.isPending} onClick={submit} className={cn('grid w-12 place-items-center rounded-lg text-paper disabled:opacity-50', asHuman ? 'bg-madder' : 'bg-indigo')}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel title="Context">
          <KV k="Verification" v={c.verified ? <span className="inline-flex items-center gap-1 text-leaf"><ShieldCheck className="h-4 w-4" />Order + phone verified</span> : <span className="inline-flex items-center gap-1 text-[hsl(32_80%_30%)]"><ShieldQuestion className="h-4 w-4" />Not verified</span>} />
          <KV k="Order" v={c.orderId ?? '—'} mono />
          <KV k="Updated" v={ago(c.updatedAt)} />
          {c.ticket && <KV k="Ticket" v={<Pill value={`${c.ticket.priority} · ${c.ticket.status}`} />} />}
          <div className="mt-2"><PendingAction action={c.pendingAction} /></div>
        </Panel>
        <Panel title="Tool trace"><div className="max-h-[480px] overflow-auto pr-1"><ToolTrace tools={c.tools} /></div></Panel>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const search = useSearch();
  const [, nav] = useLocation();
  const selected = new URLSearchParams(search).get('c') ?? '';
  const { data, isLoading, error, refetch } = useGetConversations();
  const [filter, setFilter] = useState('ALL');
  const [q, setQ] = useState('');
  const [startOpen, setStartOpen] = useState(false);
  const list = useMemo(() => (data ?? []).filter((c) => (filter === 'ALL' || c.status === filter) &&
    (!q || `${c.customerName} ${c.customerId} ${c.orderId ?? ''} ${c.lastMessage ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, filter, q]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, (data ?? []).filter((c) => f === 'ALL' || c.status === f).length])), [data]);
  const select = (id: string) => nav(`/ops/inbox?c=${id}`);
  useEffect(() => {
    if (!selected && list.length && window.innerWidth >= 1024) nav(`/ops/inbox?c=${list[0].id}`, { replace: true });
  }, [selected, list, nav]);

  return (
    <>
      <PageHeader kicker="Conversations" title="Inbox" sub="Every AI decision is inspectable: messages, verification, tool calls and pending actions.">
        <button data-testid="button-open-start" onClick={() => setStartOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo px-3 py-2 text-sm font-medium text-paper"><MessageSquarePlus className="h-4 w-4" />Start conversation</button>
      </PageHeader>
      <StartDialog open={startOpen} setOpen={setStartOpen} onCreated={select} />
      {error ? <ErrorState error={error} retry={refetch} /> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className={cn('space-y-3', selected && 'hidden lg:block')}>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input data-testid="input-search-conversations" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, order, message" className="bg-card pl-9" /></div>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="grid w-full grid-cols-4 bg-secondary">
                {FILTERS.map((f) => <TabsTrigger key={f} value={f} data-testid={`filter-${f.toLowerCase()}`} className="px-1 text-[11px]">{f === 'ALL' ? 'All' : f === 'AI_HANDLING' ? 'AI' : f === 'NEEDS_HUMAN' ? 'Human' : 'Done'} <span className="ml-1 font-data opacity-60">{counts[f]}</span></TabsTrigger>)}
              </TabsList>
              <TabsContent value={filter} />
            </Tabs>
            {isLoading ? <Rows n={6} h="h-16" /> : list.length === 0 ? (
              <Panel><Empty icon={<MessagesSquare className="h-6 w-6" />} title={data?.length ? 'Nothing in this view' : 'No conversations yet'}
                body={data?.length ? 'Change the filter or search.' : 'The dataset ships with zero chats on purpose. Start one for any seeded customer to watch the agent work.'}
                action={!data?.length && <button data-testid="button-empty-start" onClick={() => setStartOpen(true)} className="rounded-lg bg-indigo px-3 py-1.5 text-sm text-paper">Start the first one</button>} /></Panel>
            ) : (
              <ul className="space-y-1.5">
                {list.map((c) => (
                  <li key={c.id}>
                    <button data-testid={`row-conversation-${c.id}`} onClick={() => select(c.id)}
                      className={cn('w-full rounded-xl border px-3 py-2.5 text-left transition-all', selected === c.id ? 'border-indigo bg-card shadow-sm' : 'border-transparent hover:border-border hover:bg-card')}>
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', c.status === 'NEEDS_HUMAN' ? 'bg-madder live-dot' : c.status === 'RESOLVED' ? 'bg-leaf' : 'bg-indigo')} />
                        <span className="truncate text-sm font-medium">{c.customerName}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{ago(c.updatedAt)}</span>
                      </div>
                      <div className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{c.lastMessage || 'No messages yet'}</div>
                      <div className="mt-1 flex gap-1 pl-4"><span className="font-data text-[10px] text-muted-foreground">{c.orderId ?? c.customerId}</span>{c.verified && <ShieldCheck className="h-3 w-3 text-leaf" />}<span className="text-[10px] text-muted-foreground">{human(c.status)}</span></div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={cn(!selected && 'hidden lg:block')}>
            {selected ? (
              <>
                <button data-testid="button-back-list" onClick={() => nav('/ops/inbox')} className="mb-3 text-sm text-muted-foreground underline lg:hidden">Back to list</button>
                <Thread id={selected} />
              </>
            ) : (
              <Panel><Empty icon={<MessagesSquare className="h-6 w-6" />} title="Pick a conversation" body="Select a thread to read messages, inspect tool calls and take over from the AI." /></Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
