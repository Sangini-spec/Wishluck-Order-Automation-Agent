import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Loader2 } from 'lucide-react';
import { useCreateTestOrder, useGetCustomers, useGetProducts } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { invalidateData } from '@/hooks/use-live';
import { errMsg, inr } from '@/lib/format';

export function CreateTestOrder() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customerId: '', sku: '', size: '', quantity: '1', paymentMethod: 'COD' as 'COD' | 'PREPAID' });
  const { data: customers } = useGetCustomers();
  const { data: products } = useGetProducts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const m = useCreateTestOrder({
    mutation: {
      onSuccess: (o) => {
        invalidateData(qc);
        setOpen(false);
        toast({ title: `Test order ${o.id} created`, description: 'Marked as a demo order. COD workflow does not start until you trigger it.' });
        nav(`/ops/orders/${o.id}`);
      },
      onError: (e) => toast({ title: 'Order not created', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const product = products?.find((p) => p.sku === f.sku);
  const valid = f.customerId && f.sku && f.size && Number(f.quantity) >= 1 && Number(f.quantity) <= 10;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="button-new-test-order" className="inline-flex items-center gap-2 rounded-lg bg-indigo px-3 py-2 text-sm font-medium text-paper hover:opacity-95"><FlaskConical className="h-4 w-4" />Create test order</button>
      </DialogTrigger>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New test order</DialogTitle>
          <DialogDescription>Creates a flagged demo order for an existing customer. No payment or courier integration is called.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Customer</Label>
            <Select value={f.customerId} onValueChange={(v) => setF({ ...f, customerId: v })}>
              <SelectTrigger data-testid="select-customer" className="mt-1"><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>{customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.id} · {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Product</Label>
            <Select value={f.sku} onValueChange={(v) => setF({ ...f, sku: v, size: '' })}>
              <SelectTrigger data-testid="select-product" className="mt-1"><SelectValue placeholder="Choose product" /></SelectTrigger>
              <SelectContent>{products?.map((p) => <SelectItem key={p.sku} value={p.sku}>{p.name} · {inr(p.price)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Size</Label>
              <Select value={f.size} onValueChange={(v) => setF({ ...f, size: v })} disabled={!product}>
                <SelectTrigger data-testid="select-size" className="mt-1"><SelectValue placeholder="Size" /></SelectTrigger>
                <SelectContent>{product?.sizes.map((s) => {
                  const st = product.inventory.find((i) => i.size === s);
                  return <SelectItem key={s} value={s}>{s}{st ? ` (${st.available})` : ''}</SelectItem>;
                })}</SelectContent>
              </Select>
            </div>
            <div><Label>Qty</Label><Input data-testid="input-quantity" type="number" min={1} max={10} className="mt-1" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
            <div><Label>Payment</Label>
              <Select value={f.paymentMethod} onValueChange={(v) => setF({ ...f, paymentMethod: v as 'COD' | 'PREPAID' })}>
                <SelectTrigger data-testid="select-payment" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="COD">COD</SelectItem><SelectItem value="PREPAID">Prepaid</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <button data-testid="button-create-order" disabled={!valid || m.isPending}
            onClick={() => m.mutate({ data: { ...f, quantity: Number(f.quantity) } })}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Create order
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
