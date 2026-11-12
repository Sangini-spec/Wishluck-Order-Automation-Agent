import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { OpsShell, StoreShell, useSession } from '@/components/shell';
import { ChatWidget } from '@/components/chat-widget';
import AuthPage from '@/pages/auth';
import Overview from '@/pages/ops/overview';
import InboxPage from '@/pages/ops/inbox';
import Support from '@/pages/ops/support';
import Orders from '@/pages/ops/orders';
import OrderPage from '@/pages/ops/order-page';
import Cod from '@/pages/ops/cod';
import Courier from '@/pages/ops/courier';
import Analytics from '@/pages/ops/analytics';
import ActivityPage from '@/pages/ops/activity';
import SettingsPage from '@/pages/ops/settings';
import Catalogue from '@/pages/store/catalogue';
import ProductPage from '@/pages/store/product';
import MyOrders from '@/pages/store/orders';
import ProfilePage from '@/pages/store/profile';
import CartPage from '@/pages/store/cart';
import CheckoutPage from '@/pages/store/checkout';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function StoreChat() {
  const { data } = useSession();
  return data?.user ? <ChatWidget userId={data.user.id} /> : null;
}

const ops = (C: () => ReactNode) => () => <OpsShell><RoutedErrorBoundary><C /></RoutedErrorBoundary></OpsShell>;
const store = (C: () => ReactNode) => () => <StoreShell><RoutedErrorBoundary><C /></RoutedErrorBoundary><StoreChat /></StoreShell>;

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={AuthPage} />
        <Route path="/ops" component={ops(Overview)} />
        <Route path="/ops/inbox" component={ops(InboxPage)} />
        <Route path="/ops/support" component={ops(Support)} />
        <Route path="/ops/orders" component={ops(Orders)} />
        <Route path="/ops/orders/:id" component={ops(OrderPage)} />
        <Route path="/ops/cod" component={ops(Cod)} />
        <Route path="/ops/courier" component={ops(Courier)} />
        <Route path="/ops/analytics" component={ops(Analytics)} />
        <Route path="/ops/activity" component={ops(ActivityPage)} />
        <Route path="/ops/settings" component={ops(SettingsPage)} />
        <Route path="/store" component={store(Catalogue)} />
        <Route path="/store/product/:sku" component={store(ProductPage)} />
        <Route path="/store/cart" component={store(CartPage)} />
        <Route path="/store/checkout" component={store(CheckoutPage)} />
        <Route path="/store/orders" component={store(MyOrders)} />
        <Route path="/store/profile" component={store(ProfilePage)} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
