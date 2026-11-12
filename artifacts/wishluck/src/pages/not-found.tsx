import { Link } from 'wouter';
import { Wordmark } from '@/components/shell';

export default function NotFound() {
  return (
    <div className="grain grid min-h-[100dvh] place-items-center bg-background px-6">
      <div className="text-center">
        <div className="mb-8 flex justify-center"><Wordmark /></div>
        <div className="font-data text-[11px] uppercase tracking-[0.25em] text-madder">Error 404 · parcel not found</div>
        <h1 className="font-display mt-3 text-6xl font-semibold">Returned to sender.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">This address does not exist in the ledger. It may have been mistyped, or never shipped.</p>
        <Link href="/" data-testid="link-home" className="mt-6 inline-block rounded-lg bg-indigo px-4 py-2 text-sm text-paper">Back to the gateway</Link>
      </div>
    </div>
  );
}
