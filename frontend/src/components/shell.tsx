import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity, BarChart3, Banknote, Inbox, LayoutGrid, LifeBuoy, LogOut, Package, Settings, Truck, ShoppingBag, Receipt, UserRound, ShoppingCart,
} from 'lucide-react';
import { useGetCart, useGetSession, getGetSessionQueryKey, useLogout, type SessionInfo } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useLive } from '@/hooks/use-live';
import { Skeleton } from '@/components/ui/skeleton';

export function useSession() {
  return useGetSession({ query: { queryKey: getGetSessionQueryKey(), retry: false, staleTime: 30000 } });
}

function Wordmark({ light, store }: { light?: boolean; store?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('grid h-7 w-7 place-items-center rounded-md', light ? 'bg-turmeric text-indigo' : 'bg-indigo text-turmeric')}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2l2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6z" /></svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">{store ? 'Wishluck Store' : 'WishLuck'}</span>
    </span>
  );
}
export { Wordmark };

function Booting() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background">
      <div className="w-64 space-y-3">
        <Skeleton className="h-6 w-32 bg-muted" />
        <Skeleton className="h-3 w-full bg-muted" />
        <Skeleton className="h-3 w-4/5 bg-muted" />
      </div>
    </div>
  );
}

export function Guard({ role, children }: { role: 'TEAM' | 'CUSTOMER'; children: (s: SessionInfo) => ReactNode }) {
  const { data, isLoading, isError } = useSession();
  const [, nav] = useLocation();
  const ok = !!data?.authenticated && data.user?.role === role;
  useEffect(() => {
    if (isLoading) return;
    if (isError || !data?.authenticated) nav('/');
    else if (data.user?.role !== role) nav(data.user?.role === 'TEAM' ? '/ops' : '/store');
  }, [isLoading, isError, data, role, nav]);
  if (!ok || !data) return <Booting />;
  return <>{children(data)}</>;
}

function useSignOut() {
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const m = useLogout();
  return {
    pending: m.isPending,
    run: () =>
      m.mutate(undefined, {
        onSettled: () => {
          qc.clear();
          nav('/');
        },
      }),
  };
}

function LiveBadge({ mode, dark }: { mode: string; dark?: boolean }) {
  return (
    <span data-testid="status-live" className={cn('inline-flex items-center gap-1.5 text-[11px] font-data uppercase tracking-wider', dark ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', mode === 'live' ? 'bg-leaf live-dot' : mode === 'polling' ? 'bg-turmeric' : 'bg-muted-foreground')} />
      {mode === 'live' ? 'Live' : mode === 'polling' ? 'Polling' : 'Idle'}
    </span>
  );
}

const NAV = [
  { href: '/ops', label: 'Overview', icon: LayoutGrid },
  { href: '/ops/inbox', label: 'Inbox', icon: Inbox },
  { href: '/ops/support', label: 'Tickets', icon: LifeBuoy },
  { href: '/ops/orders', label: 'Orders', icon: Package },
  { href: '/ops/cod', label: 'COD risk', icon: Banknote },
  { href: '/ops/courier', label: 'Courier', icon: Truck },
  { href: '/ops/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/ops/activity', label: 'Activity', icon: Activity },
  { href: '/ops/settings', label: 'Settings', icon: Settings },
];

export function OpsShell({ children }: { children: ReactNode }) {
  return <Guard role="TEAM">{(s) => <OpsFrame session={s}>{children}</OpsFrame>}</Guard>;
}

function OpsFrame({ session, children }: { session: SessionInfo; children: ReactNode }) {
  const [loc] = useLocation();
  const mode = useLive(true);
  const out = useSignOut();
  const active = (h: string) => (h === '/ops' ? loc === '/ops' : loc.startsWith(h));
  return (
    <div className="grain min-h-[100dvh] bg-background md:flex">
      <aside className="block-print sticky top-0 z-30 flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:h-[100dvh] md:w-60">
        <div className="flex items-center justify-between px-4 py-4 md:px-5 md:py-5">
          <Link href="/ops" data-testid="link-home"><Wordmark light /></Link>
          <span className="md:hidden"><LiveBadge mode={mode} dark /></span>
        </div>
        <div className="hidden px-5 pb-2 font-data text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/45 md:block">Operations desk</div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, '-')}`}
              className={cn('group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active(n.href) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground')}>
              <n.icon className={cn('h-4 w-4', active(n.href) ? 'text-turmeric' : '')} />
              {n.label}
              {active(n.href) && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-turmeric md:block" />}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-sidebar-border px-5 py-4 md:block">
          <LiveBadge mode={mode} dark />
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-turmeric font-semibold text-indigo text-sm">
              {(session.user?.username ?? 'T').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div data-testid="text-username" className="truncate text-sm font-medium">{session.user?.username}</div>
              <div className="text-[11px] text-sidebar-foreground/55">Team{session.demoMode ? ' · demo' : ''}</div>
            </div>
            <button data-testid="button-logout" onClick={out.run} disabled={out.pending} className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1400px]">{children}</div>
        <button data-testid="button-logout-mobile" onClick={out.run} className="mt-10 text-sm text-muted-foreground underline md:hidden">Sign out</button>
      </main>
    </div>
  );
}

export function StoreShell({ children }: { children: ReactNode }) {
  return <Guard role="CUSTOMER">{(s) => <StoreFrame session={s}>{children}</StoreFrame>}</Guard>;
}

function StoreFrame({ session, children }: { session: SessionInfo; children: ReactNode }) {
  const [loc] = useLocation();
  useLive(true);
  const out = useSignOut();
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <div className="overflow-hidden bg-indigo py-1.5 text-[11px] font-data uppercase tracking-[0.2em] text-paper/80">
        <div className="marquee flex w-max gap-12 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex gap-12">
              <span>Wishluck Store everyday edit</span><span>Cash on delivery where available</span>
              <span>Ask our assistant about any order</span><span>Return and exchange rules shown on every product</span>
            </span>
          ))}
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
          <Link href="/store" data-testid="link-store-home" className="shrink-0"><Wordmark store /></Link>
          <nav className="flex gap-1 overflow-x-auto text-sm">
            <Link href="/store" data-testid="link-catalogue" className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5', loc === '/store' || loc.startsWith('/store/product') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}><ShoppingBag className="h-4 w-4" />Shop</Link>
            <Link href="/store/orders" data-testid="link-my-orders" className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5', loc === '/store/orders' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}><Receipt className="h-4 w-4" />My orders</Link>
            <Link href="/store/profile" data-testid="link-profile" className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5', loc === '/store/profile' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}><UserRound className="h-4 w-4" />Profile</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <CartLink active={loc === '/store/cart' || loc === '/store/checkout'} />
            <div className="hidden text-right sm:block">
              <div data-testid="text-username" className="text-sm font-medium">{session.user?.username}</div>
              <div className="font-data text-[10px] text-muted-foreground">{session.user?.customerId ?? 'Customer'}</div>
            </div>
            <button data-testid="button-logout" onClick={out.run} className="rounded-md border p-2 text-muted-foreground hover:text-foreground" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}

function CartLink({ active }: { active: boolean }) {
  const { data } = useGetCart();
  return (
    <Link href="/store/cart" data-testid="link-cart" className={cn('relative flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm', active ? 'border-indigo bg-indigo text-paper' : 'bg-card hover:border-indigo')}>
      <ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">Bag</span>
      {!!data?.count && <span data-testid="text-cart-count" className="grid h-5 min-w-5 place-items-center rounded-full bg-turmeric px-1 font-data text-[10px] text-indigo">{data.count}</span>}
    </Link>
  );
}
