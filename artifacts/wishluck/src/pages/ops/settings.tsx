import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Fingerprint, Loader2, Save } from 'lucide-react';
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
  { k: 'ndrFollowupSeconds', label: 'NDR follow-up after', min: 2, max: 86400, unit: 's', hint: 'Delay after a failed delivery before contacting' },
  { k: 'riskHighThreshold', label: 'High risk threshold', min: 1, max: 100, unit: 'pts', hint: 'Scores at or above are HIGH' },
  { k: 'riskMediumThreshold', label: 'Medium risk threshold', min: 0, max: 99, unit: 'pts', hint: 'Must be below high threshold' },
];

export default function SettingsPage() {
  const s = useGetSettings();
  const d = useGetDataset();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (s.data) setF(Object.fromEntries(FIELDS.map((x) => [x.k, String(s.data[x.k])])));
  }, [s.data]);
  const m = useUpdateSettings({ mutation: { onSuccess: () => { invalidateData(qc); toast({ title: 'Settings saved', description: 'New timings apply to workflows started from now.' }); }, onError: (e) => toast({ title: 'Not saved', description: errMsg(e), variant: 'destructive' }) } });
  const errs = FIELDS.map((x) => { const n = Number(f[x.k]); return !Number.isFinite(n) || n < x.min || n > x.max ? `${x.label}: ${x.min}–${x.max}` : null; }).filter(Boolean) as string[];
  if (Number(f.riskMediumThreshold) >= Number(f.riskHighThreshold)) errs.push('Medium threshold must be below high threshold');
  const dirty = s.data && FIELDS.some((x) => String(s.data[x.k]) !== f[x.k]);
  const ds = d.data;
  const counts = rec(ds?.counts);
  return (
    <>
      <PageHeader kicker="Controls" title="Settings and dataset" sub="Tune workflow timing and risk bands. Verify the imported dataset is intact." />
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
              {errs.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-madder">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
              <div className="mt-4 flex items-center gap-3">
                <button data-testid="button-save-settings" disabled={!dirty || errs.length > 0 || m.isPending} onClick={() => m.mutate({ data: Object.fromEntries(FIELDS.map((x) => [x.k, Number(f[x.k])])) as unknown as SettingsInput })} className="inline-flex items-center gap-2 rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper disabled:opacity-50">
                  {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes
                </button>
                {dirty && <button data-testid="button-reset-settings" onClick={() => setF(Object.fromEntries(FIELDS.map((x) => [x.k, String(s.data![x.k])])))} className="text-sm text-muted-foreground underline">Discard</button>}
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
              <Panel title={`Import warnings (${ds.warnings.length})`}>
                {ds.warnings.length === 0 ? <p className="text-sm text-muted-foreground">No warnings recorded on import.</p> : (
                  <ul className="max-h-72 space-y-1.5 overflow-auto text-sm">{arr(ds.warnings).map((w, i) => <li key={i} className="flex gap-2"><span className="font-data text-xs text-[hsl(32_80%_30%)]">{str(w.code)}</span><span>{str(w.detail ?? w.message)}</span>{!!w.orderId && <span className="font-data text-xs text-muted-foreground">{str(w.orderId)}</span>}</li>)}</ul>
                )}
              </Panel>
              <Panel title={`Scenarios (${ds.scenarios.length})`}>
                {ds.scenarios.length === 0 ? <p className="text-sm text-muted-foreground">No scenarios tagged.</p> : (
                  <ul className="max-h-80 space-y-2 overflow-auto">{arr(ds.scenarios).map((sc, i) => (
                    <li key={i} className="rounded-lg border p-2.5 text-sm"><div className="flex items-center gap-2"><span className="font-medium">{str(sc.name ?? sc.tag ?? sc.id)}</span>{!!sc.orderId && <span className="font-data text-xs text-muted-foreground">{str(sc.orderId)}</span>}</div>{!!sc.description && <p className="mt-0.5 text-xs text-muted-foreground">{str(sc.description)}</p>}</li>
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
