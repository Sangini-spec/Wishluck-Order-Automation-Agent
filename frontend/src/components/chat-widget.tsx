import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send, ShieldCheck, X, RotateCcw, ChevronLeft, Plus, CheckCircle2 } from 'lucide-react';
import { useCreateConversation, useGetConversation, useGetConversations, getGetConversationsQueryKey, getGetConversationQueryKey, useSendMessage, useResolveCustomerConversation, getGetAnalyticsQueryKey } from '@workspace/api-client-react';
import { MessageList } from '@/components/convo';
import { Pill } from '@/components/kit';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { errMsg, ago } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ChatWidget({ userId }: { userId: string }) {
  const key = `wl-chat-${userId}`;
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState<string>(() => localStorage.getItem(key) ?? '');
  const [text, setText] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();
  const seenKey = `wl-chat-seen-${userId}`;
  const [seen, setSeen] = useState<string>(() => localStorage.getItem(seenKey) ?? '');
  const [listing, setListing] = useState(false);
  const list = useGetConversations({ query: { queryKey: getGetConversationsQueryKey(), refetchInterval: 20000 } });
  const convs = useMemo(() => [...(list.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [list.data]);
  const fresh = convs.filter((x) => x.id !== cid && (!seen || x.updatedAt > seen));
  const markSeen = () => { const t = convs[0]?.updatedAt ?? new Date().toISOString(); localStorage.setItem(seenKey, t); setSeen(t); };
  const pick = (id: string) => { localStorage.setItem(key, id); setCid(id); setListing(false); markSeen(); };
  const conv = useGetConversation(cid, { query: { enabled: !!cid, queryKey: getGetConversationQueryKey(cid), retry: false } });
  useEffect(() => {
    if (conv.error) { localStorage.removeItem(key); setCid(''); }
  }, [conv.error, key]);
  const create = useCreateConversation({
    mutation: {
      onSuccess: (c) => { localStorage.setItem(key, c.id); setCid(c.id); setListing(false); qc.invalidateQueries({ queryKey: getGetConversationsQueryKey() }); qc.setQueryData(getGetConversationQueryKey(c.id), c); },
      onError: (e) => toast({ title: 'Chat unavailable', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const send = useSendMessage({
    mutation: {
      onSuccess: (c) => { qc.setQueryData(getGetConversationQueryKey(cid), c); setText(''); invalidateData(qc); },
      onError: (e) => toast({ title: 'Message not sent', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const resolve = useResolveCustomerConversation({
    mutation: {
      onSuccess: (r) => {
        qc.setQueryData(getGetConversationQueryKey(r.id), r);
        qc.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetConversationQueryKey(r.id) });
        qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
        toast({ title: 'Marked as resolved', description: 'Glad we could help. Start a new chat anytime.' });
      },
      onError: (e) => toast({ title: 'Could not resolve', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const c = conv.data;
  const canResolve = !!c && c.status === 'AI_HANDLING' && !c.pendingAction && !send.isPending && !resolve.isPending
    && c.messages.some((m) => m.role === 'user') && c.messages.some((m) => m.role === 'assistant');
  const submit = () => text.trim() && cid && send.mutate({ id: cid, data: { content: text.trim(), asHuman: false } });
  const restart = () => { localStorage.removeItem(key); setCid(''); create.mutate({ data: {} }); };

  return (
    <>
      <button data-testid="button-open-chat" onClick={() => { if (!open && fresh.length) setListing(true); setOpen(!open); }} className={cn('fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-indigo px-5 py-3.5 text-paper shadow-[0_18px_40px_-14px_hsl(232_58%_20%/0.7)] transition-transform hover:-translate-y-0.5', open && 'scale-90')}>
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5 text-turmeric" />}<span className="text-sm font-medium">{open ? 'Close' : 'Order help'}</span>
        {!open && fresh.length > 0 && <span data-testid="badge-new-conversations" className="grid h-5 min-w-5 place-items-center rounded-full bg-turmeric px-1 font-data text-[10px] text-indigo">{fresh.length}</span>}
      </button>
      {open && (
        <div data-testid="panel-chat" className="rise fixed inset-x-3 bottom-20 z-40 flex h-[min(620px,75dvh)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[400px]">
          <div className="block-print bg-indigo px-4 py-3 text-paper">
            <div className="flex items-center gap-2">
              {convs.length > 0 && <button data-testid="button-chat-list" onClick={() => { setListing(!listing); markSeen(); }} title="All conversations" className="relative rounded p-1 text-paper/70 hover:text-paper"><ChevronLeft className="h-4 w-4" />{fresh.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-turmeric" />}</button>}
              <div className="font-display text-lg font-semibold">WishLuck help</div>
              {c && <Pill value={c.status} className="bg-paper/10 text-paper border-paper/20" />}
              {c && <button data-testid="button-restart-chat" onClick={restart} title="New conversation" className="ml-auto rounded p-1 text-paper/70 hover:text-paper"><RotateCcw className="h-4 w-4" /></button>}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-paper/70">
              {c?.verified ? <><ShieldCheck className="h-3.5 w-3.5 text-turmeric" />Verified for {c.orderId}</> : 'Share your order ID and full phone number to discuss an order'}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {listing ? (
              <div data-testid="list-conversations" className="space-y-2">
                <button data-testid="button-new-conversation" disabled={create.isPending} onClick={() => create.mutate({ data: {} })} className="flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-indigo hover:bg-accent">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}New conversation</button>
                {convs.map((x) => (
                  <button key={x.id} data-testid={`row-conversation-${x.id}`} onClick={() => pick(x.id)} className={cn('w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-indigo', x.id === cid ? 'border-indigo bg-accent' : 'bg-card')}>
                    <div className="flex items-center gap-2">
                      <span className="font-data text-xs">{x.orderId ?? 'General'}</span>
                      {fresh.some((f) => f.id === x.id) && <span className="rounded-full bg-turmeric/40 px-1.5 text-[10px] font-medium">New</span>}
                      <Pill value={x.status} className="ml-auto" />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{x.lastMessage ?? 'No messages yet'}</div>
                    <div className="mt-0.5 font-data text-[10px] text-muted-foreground">{ago(x.updatedAt)}</div>
                  </button>
                ))}
              </div>
            ) : !cid ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-indigo"><MessageCircle className="h-6 w-6" /></div>
                <div className="font-display mt-3 text-xl font-semibold">Ask about any order</div>
                <p className="mt-1 max-w-[260px] text-sm text-muted-foreground">Track a parcel, confirm cash on delivery, change an address, or ask about returns. Replies come from our assistant; a person can step in.</p>
                <button data-testid="button-start-chat" disabled={create.isPending} onClick={() => create.mutate({ data: {} })} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm text-paper disabled:opacity-60">
                  {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Start chat
                </button>
              </div>
            ) : conv.isLoading || !c ? (
              <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : c.messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Say hello. For order questions, include your order ID (for example WL10239) and the phone number on the order.</p>
            ) : <MessageList messages={c.messages} perspective="customer" />}
            {send.isPending && <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="live-dot h-1.5 w-1.5 rounded-full bg-indigo" style={{ animationDelay: `${i * 150}ms` }} />)}</span>Assistant is checking</div>}
          </div>
          {cid && !listing && c?.status === 'RESOLVED' && (
            <div data-testid="status-chat-resolved" className="flex items-center gap-2 border-t bg-leaf/10 px-4 py-2 text-xs text-leaf"><CheckCircle2 className="h-4 w-4" />Resolved — thanks for confirming.</div>
          )}
          {cid && !listing && (canResolve || resolve.isPending) && (
            <div className="border-t px-3 pt-2">
              <button data-testid="button-resolve-chat" disabled={!canResolve} onClick={() => resolve.mutate({ id: c!.id })} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-leaf/40 px-3 py-1.5 text-xs font-medium text-leaf hover:bg-leaf/10 disabled:opacity-60">
                {resolve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}This solved my issue
              </button>
            </div>
          )}
          {cid && !listing && (
            <div className="flex gap-2 border-t p-3">
              <input data-testid="input-chat-message" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} disabled={c?.status === 'RESOLVED'}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder={c?.status === 'RESOLVED' ? 'Conversation resolved — start a new one' : 'Type a message'}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-indigo" />
              <button data-testid="button-send-chat" disabled={!text.trim() || send.isPending} onClick={submit} className="grid w-10 place-items-center rounded-lg bg-indigo text-paper disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
