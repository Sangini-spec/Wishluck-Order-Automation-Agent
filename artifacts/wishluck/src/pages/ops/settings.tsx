import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Fingerprint, Loader2, Lock, Save, X } from 'lucide-react';
import { useGetSettings, useUpdateSettings, useGetDataset, type SettingsInput } from '@workspace/api-client-react';
import { PageHeader, Panel, Rows, ErrorState, JsonBlock, KV, Pill } from '@/components/kit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { arr, rec, str, when, secs, errMsg, human } from '@/lib/format';

const FIELDS: { k: keyof SettingsInput; label: string; min: number; max: number; unit: string; hint: string }[] = [
  { k: 'codReminderSeconds', label: 'COD reminder after', min: 2, max: 86400, unit: 's', hint: 'Delay before nudging an unconfirmed COD order' },
  { k: 'codHoldSeconds', label: 'COD hold after', min: 3, max: 604800, unit: 's', hint: 'Order is held if still unconfirmed' },
  { k: 'ndrFollowupSeconds', label: 'Unanswered NDR escalation delay', min: 2, max: 86400, unit: 's', hint: 'Initial outreach after a failed delivery is immediate; this is how long an unanswered NDR waits before escalating' },
  { k: 'riskHighThreshold', label: 'High risk threshold', min: 1, max: 100, unit: 'pts', hint: 'Scores at or above are HIGH' },
  { k: 'riskMediumThreshold', label: 'Medium risk threshold', min: 0, max: 99, unit: 'pts', hint: 'Must be below high threshold' },
];

const HFIELDS: { k: keyof SettingsInput; label: string; min: number; max: number; def: number; unit: string; hint: string }[] = [
  { k: 'handoverRefundThreshold', label: 'Refund amount handover', min: 1, max: 1500, def: 1500, unit: '₹', hint: 'Refunds at or above this go to a person. Can only be lowered below the ₹1,500 policy ceiling' },
  { k: 'handoverUnresolvedTurns', label: 'Unresolved turns', min: 1, max: 2, def: 2, unit: 'turns', hint: 'Customer turns without progress before handover' },
  { k: 'handoverToolFailures', label: 'Tool failures', min: 1, max: 2, def: 2, unit: 'fails', hint: 'Failed lookups or actions before handover' },
  { k: 'handoverClarifications', label: 'Clarification requests', min: 1, max: 2, def: 2, unit: 'asks', hint: 'Times the assistant may ask to clarify before handover' },
];
type Form = Record<string, string> & { __kw?: never };
const pick = (d: Record<string, unknown>) => Object.fromEntries([...FIELDS.map((x) => [x.k, String(d[x.k] ?? '')]), ...HFIELDS.map((x) => [x.k, String(d[x.k] ?? x.def)])]) as Form;
const kwOf = (d: Record<string, unknown>) => (Array.isArray(d.handoverKeywords) ? d.handoverKeywords.map(String) : []);

export default function SettingsPage() {
  const s = useGetSettings();
  const d = useGetDataset();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<Form>({});
  const [kw, setKw] = useState<string[]>([]);
  const [kwIn, setKwIn] = useState('');
  const sd: Record<string, unknown> | undefined = s.data ? { ...s.data } : undefined;
  const reset = () => { if (sd) { setF(pick(sd)); setKw(kwOf(sd)); setKwIn(''); } };
  useEffect(() => { reset(); }, [s.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const addKw = () => { const v = kwIn.trim().replace(/\s+/g, ' '); if (v.length < 3 || v.length > 80 || kw.length >= 20 || kw.some((k) => k.toLowerCase() === v.toLowerCase())) return; setKw([...kw, v]); setKwIn(''); };
  const m = useUpdateSettings({ mutation: { onSuccess: () => { invalidateData(qc); toast({ title: 'Settings saved', description: 'New timings apply to workflows started from now.' }); }, onError: (e) => toast({ title: 'Not saved', description: errMsg(e), variant: 'destructive' }) } });
  const errs = FIELDS.map((x) => { const n = Number(f[x.k]); return !Number.isFinite(n) || n < x.min || n > x.max ? `${x.label}: ${x.min}–${x.max}` : null; }).filter(Boolean) as string[];
  HFIELDS.forEach((x) => { const n = Number(f[x.k]); if (!Number.isInteger(n) || n < x.min || n > x.max) errs.push(`${x.label}: ${x.min}–${x.max}`); });
  if (Number(f.riskMediumThreshold) >= Number(f.riskHighThreshold)) errs.push('Medium threshold must be below high threshold');
  if (kw.length > 20) errs.push('At most 20 handover phrases');
  const kwInvalid = kwIn.trim().length > 0 && (kwIn.trim().length < 3 || kwIn.trim().length > 80);
  const dirty = !!sd && (Object.entries(pick(sd)).some(([k, v]) => v !== f[k]) || JSON.stringify(kwOf(sd)) !== JSON.stringify(kw));
  const n = (k: string) => Number(f[k]);
  const payload = (): SettingsInput => ({ codReminderSeconds: n('codReminderSeconds'), codHoldSeconds: n('codHoldSeconds'), ndrFollowupSeconds: n('ndrFollowupSeconds'), riskHighThreshold: n('riskHighThreshold'), riskMediumThreshold: n('riskMediumThreshold'), handoverRefundThreshold: n('handoverRefundThreshold'), handoverUnresolvedTurns: n('handoverUnresolvedTurns'), handoverToolFailures: n('handoverToolFailures'), handoverClarifications: n('handoverClarifications'), handoverKeywords: kw });
  const ds = d.data;
  const counts = rec(ds?.counts);
  return (
    <>
      <PageHeader kicker="Controls" title="Workflow settings" sub="Tune reminders, risk bands and handover triggers. Review store policies and demo records." />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          {s.error ? <ErrorState error={s.error} retry={s.refetch} /> : s.isLoading || !s.data ? <Rows n={5} h="h-16" /> : (
            <Panel title="Workflow timings and risk" action={<Pill value={s.data.demoMode ? 'Demo mode' : 'Live mode'} t={s.data.demoMode ? 'turmeric' : 'leaf'} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((x) => (
                  <div key={x.k}>
                    <Label htmlFor={x.k}>{x.label}</Label>
                    <div className="relative mt-1">
                      <Input id={x.k} data-testid={`input-${x.k}`} type="number" min={x.min} max={x.max} value={f[x.k] ?? ''} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} className="pr-12 font-data" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{x.unit}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{x.hint}{x.unit === 's' && f[x.k] ? ` · ${secs(Number(f[x.k]))}` : ''}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t pt-4">
                <div className="font-display text-lg font-semibold">Human handover triggers</div>
                <p className="mt-0.5 text-xs text-muted-foreground">When the assistant passes a conversation to the team.</p>
                <div data-testid="text-handover-safeguards" className="mt-3 flex gap-2 rounded-lg border border-indigo/25 bg-accent/60 p-3 text-xs leading-relaxed">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo" />
                  <span>Mandatory safeguards always apply and cannot be disabled here: requests for a human, legal or consumer-forum threats, and anything routed to manual review always hand over. These settings can only make handover <em>earlier</em> — the refund threshold can be lowered, never raised above ₹1,500.</span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {HFIELDS.map((x) => (
                    <div key={x.k}>
                      <Label htmlFor={x.k}>{x.label}</Label>
                      <div className="relative mt-1">
                        <Input id={x.k} data-testid={`input-${x.k}`} type="number" min={x.min} max={x.max} step={1} value={f[x.k] ?? ''} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} className="pr-14 font-data" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{x.unit}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{x.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Label htmlFor="handoverKeywords">Extra handover phrases <span className="font-data text-[11px] text-muted-foreground">{kw.length}/20</span></Label>
                  <div className="mt-1 flex gap-2">
                    <Input id="handoverKeywords" data-testid="input-handoverKeyword" value={kwIn} maxLength={80} disabled={kw.length >= 20} placeholder={kw.length >= 20 ? 'Limit reached' : 'e.g. wrong item delivered'} onChange={(e) => setKwIn(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } }} />
                    <button data-testid="button-add-keyword" type="button" onClick={addKw} disabled={kwInvalid || !kwIn.trim() || kw.length >= 20} className="rounded-lg border px-3 text-sm text-indigo disabled:opacity-50">Add</button>
                  </div>
                  <p className={`mt-1 text-[11px] ${kwInvalid ? 'text-madder' : 'text-muted-foreground'}`}>3–80 characters each. Matching customer messages hand over in addition to the built-in safeguards.</p>
                  <div data-testid="list-handover-keywords" className="mt-2 flex flex-wrap gap-1.5">
                    {kw.length === 0 && <span className="text-xs text-muted-foreground">No extra phrases.</span>}
                    {kw.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full border bg-secondary/70 py-0.5 pl-2.5 pr-1 text-xs">{k}
                        <button data-testid={`button-remove-keyword-${k}`} type="button" onClick={() => setKw(kw.filter((y) => y !== k))} className="rounded-full p-0.5 hover:bg-madder/15" title="Remove"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {errs.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-madder">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
              <div className="mt-4 flex items-center gap-3">
                <button data-testid="button-save-settings" disabled={!dirty || errs.length > 0 || m.isPending} onClick={() => m.mutate({ data: payload() })} className="inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
                  {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes
                </button>
                {dirty && <button data-testid="button-reset-settings" onClick={reset} className="text-sm text-muted-foreground underline">Discard</button>}
                <span className="ml-auto text-xs text-muted-foreground">Demo clock {when(s.data.demoClock)}</span>
              </div>
            </Panel>
          )}
          {s.data && <Panel title="Policy source"><p className="mb-2 text-xs text-muted-foreground">The full policy document the agent reasons against.</p><JsonBlock value={s.data.policy} label="policy.json" /></Panel>}
        </div>
        <div className="space-y-4">
          {d.error ? <ErrorState error={d.error} retry={d.refetch} /> : d.isLoading || !ds ? <Rows n={4} h="h-20" /> : (
            <>
              <Panel title={<span className="flex items-center gap-2"><Database className="h-4 w-4 text-indigo" />Dataset integrity</span>}>
                <KV k="Name" v={ds.name} />
                <KV k="Imported" v={when(ds.importedAt)} />
                <div className="mt-1 flex items-start gap-2 rounded-lg bg-secondary/60 p-2"><Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-madder" /><span data-testid="text-dataset-hash" className="break-all font-data text-[11px]">{ds.hash}</span></div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Object.entries(counts).map(([k, v]) => (
                    <div key={k} className="rounded-lg border px-2.5 py-2">
                      <div className="font-display text-xl font-semibold tabular-nums">{str(v)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{human(k.replace(/([A-Z])/g, '_$1'))}</div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title={`Scenarios (${ds.scenarios.length})`}>
                {ds.scenarios.length === 0 ? <p className="text-sm text-muted-foreground">No scenarios tagged.</p> : (
                  <ul className="max-h-80 space-y-2 overflow-auto">{arr(ds.scenarios).map((sc, i) => (
                    <li key={i} className="rounded-lg border p-2.5 text-sm"><div className="flex items-center gap-2"><span className="font-medium">{str(sc.scenario ?? sc.name ?? sc.tag ?? sc.id)}</span>{!!(sc.order_id ?? sc.orderId) && <span className="font-data text-xs text-muted-foreground">{str(sc.order_id ?? sc.orderId)}</span>}</div>{!!(sc.expected ?? sc.description) && <p className="mt-0.5 text-xs text-muted-foreground">{str(sc.expected ?? sc.description)}</p>}</li>
                  ))}</ul>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
