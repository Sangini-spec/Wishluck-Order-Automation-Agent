import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const ADDRESS_FIELDS = [
  { k: 'line1', label: 'Address line 1', wide: true },
  { k: 'line2', label: 'Address line 2 (optional)', wide: true },
  { k: 'landmark', label: 'Landmark (optional)', wide: true },
  { k: 'city', label: 'City' },
  { k: 'state', label: 'State' },
  { k: 'pincode', label: 'Pincode' },
] as const;
export type AddressKey = (typeof ADDRESS_FIELDS)[number]['k'];
export type AddressForm = Record<AddressKey, string>;
export const emptyAddress: AddressForm = { line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };

export function addressErrors(a: AddressForm) {
  const e: Partial<Record<AddressKey, string>> = {};
  if (!a.line1.trim()) e.line1 = 'Required';
  if (!a.city.trim()) e.city = 'Required';
  if (!a.state.trim()) e.state = 'Required';
  if (!/^[1-9]\d{5}$/.test(a.pincode.trim())) e.pincode = 'Six digits, not starting with 0';
  return e;
}

export function phoneError(p: string) {
  const d = p.replace(/\D/g, '');
  return p.trim().length < 10 || d.length < 10 || d.length > 13 ? 'Enter a valid phone, e.g. +91-9000010005' : '';
}

export function toAddressJson(a: AddressForm) {
  const out: Record<string, string> = {};
  for (const { k } of ADDRESS_FIELDS) if (a[k].trim()) out[k] = a[k].trim();
  return out;
}

export function AddressFields({ value, onChange, show, prefix = 'address' }: { value: AddressForm; onChange: (a: AddressForm) => void; show: boolean; prefix?: string }) {
  const errs = addressErrors(value);
  return (
    <div className="grid grid-cols-2 gap-3">
      {ADDRESS_FIELDS.map((f) => (
        <div key={f.k} className={cn('wide' in f ? 'col-span-2' : f.k === 'pincode' ? 'col-span-2 sm:col-span-1' : 'col-span-1')}>
          <Label htmlFor={`${prefix}-${f.k}`} className="text-xs">{f.label}</Label>
          <Input id={`${prefix}-${f.k}`} data-testid={`input-${prefix}-${f.k}`} value={value[f.k]} inputMode={f.k === 'pincode' ? 'numeric' : undefined}
            onChange={(e) => onChange({ ...value, [f.k]: e.target.value })} className={cn('mt-1 bg-background', show && errs[f.k] && 'border-madder')} />
          {show && errs[f.k] && <p className="mt-1 text-[11px] text-madder">{errs[f.k]}</p>}
        </div>
      ))}
    </div>
  );
}
