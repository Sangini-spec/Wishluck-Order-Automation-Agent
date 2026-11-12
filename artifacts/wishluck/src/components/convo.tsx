import { useEffect, useRef } from 'react';
import { Bot, CheckCircle2, CircleAlert, Cpu, User, UserCog } from 'lucide-react';
import type { Message } from '@workspace/api-client-react';
import { JsonBlock, Pill } from '@/components/kit';
import { arr, str, when, human } from '@/lib/format';
import { cn } from '@/lib/utils';

function roleOf(r: string) {
  const s = r.toLowerCase();
  if (s.includes('human') || s.includes('agent') || s.includes('team') || s.includes('staff')) return 'human';
  if (s.includes('assistant') || s.includes('ai') || s.includes('bot')) return 'ai';
  if (s.includes('system') || s.includes('tool')) return 'system';
  return 'customer';
}

export function MessageList({ messages, perspective }: { messages: Message[]; perspective: 'team' | 'customer' }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);
  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const r = roleOf(m.role);
        const mine = perspective === 'customer' ? r === 'customer' : r === 'human';
        if (r === 'system')
          return (
            <div key={m.id} data-testid={`message-${m.id}`} className="mx-auto max-w-[85%] rounded-md border border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">
              {m.content}
            </div>
          );
        const Icon = r === 'ai' ? Bot : r === 'human' ? UserCog : User;
        return (
          <div key={m.id} data-testid={`message-${m.id}`} className={cn('rise flex gap-2', mine ? 'flex-row-reverse' : '')}>
            <div className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
              r === 'ai' ? 'bg-indigo text-turmeric' : r === 'human' ? 'bg-madder text-paper' : 'bg-turmeric/30 text-foreground')}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className={cn('max-w-[78%]', mine && 'text-right')}>
              <div className={cn('inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed',
                r === 'ai' ? 'rounded-tl-sm bg-accent text-foreground' : r === 'human' ? 'bg-madder/10 border border-madder/20' : 'bg-card border',
                mine && 'rounded-tr-sm')}>
                {m.content}
              </div>
              <div className="mt-0.5 px-1 font-data text-[10px] text-muted-foreground">
                {r === 'ai' ? 'WishLuck assistant' : r === 'human' ? 'Team member' : 'Customer'} · {when(m.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function ToolTrace({ tools }: { tools: unknown }) {
  const list = arr(tools);
  if (!list.length) return <p className="text-sm text-muted-foreground">No tools called yet. Tool calls appear here as the agent works.</p>;
  return (
    <ol className="space-y-2">
      {list.map((t, i) => {
        const ok = /success|ok|complete/i.test(str(t.status));
        return (
          <li key={str(t.id, String(i))} data-testid={`tool-${str(t.id, String(i))}`} className="rounded-lg border bg-card p-2.5">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-indigo" />
              <span className="font-data text-xs font-medium">{str(t.toolName)}</span>
              {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-leaf" /> : <CircleAlert className="h-3.5 w-3.5 text-madder" />}
              <span className="ml-auto font-data text-[10px] text-muted-foreground">{str(t.durationMs, '?')}ms · {when(t.createdAt)}</span>
            </div>
            <div className="mt-2 grid gap-1.5">
              <JsonBlock value={t.input} label="Input" />
              <JsonBlock value={t.output} label={`Output · ${human(t.status)}`} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PendingAction({ action }: { action: unknown }) {
  const a = action && typeof action === 'object' ? (action as Record<string, unknown>) : null;
  if (!a || !Object.keys(a).length) return null;
  return (
    <div className="rounded-lg border border-turmeric/50 bg-turmeric/10 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[hsl(32_80%_30%)]">
        Pending action {a.type !== undefined && <Pill value={a.type ?? a.action} t="turmeric" />}
      </div>
      <JsonBlock value={a} label="Awaiting confirmation" defaultOpen />
    </div>
  );
}
