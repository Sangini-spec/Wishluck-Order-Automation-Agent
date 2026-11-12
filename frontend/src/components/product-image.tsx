import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const SKU_IMAGE: Record<string, { slug: string; alt: string }> = {
  'WL-KUR-01': { slug: 'kurta', alt: 'Cotton printed kurta, product photo' },
  'WL-TEE-02': { slug: 'graphic-tee', alt: 'Graphic t-shirt, product photo' },
  'WL-JNS-03': { slug: 'jeans', alt: 'Denim jeans, product photo' },
  'WL-BRF-04': { slug: 'briefs', alt: 'Briefs innerwear, product photo' },
  'WL-BAG-05': { slug: 'tote', alt: 'Tote bag, product photo' },
  'WL-SAL-06': { slug: 'sale-tee', alt: 'Sale t-shirt, product photo' },
};

export function productImageSrc(sku: string) {
  const m = SKU_IMAGE[sku];
  return m ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/products/${m.slug}.jpg` : null;
}

export function ProductImage({ sku, name, className, eager }: { sku: string; name?: string; className?: string; eager?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const m = SKU_IMAGE[sku];
  const src = productImageSrc(sku);
  if (!src || failedSrc === src) {
    return (
      <div role="img" aria-label={`${name ?? sku}: photo unavailable`} className={cn('relative grid place-items-center bg-secondary', className)} data-testid={`img-product-fallback-${sku}`}>
        <span className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground"><ImageOff className="h-3 w-3" aria-hidden />Photo unavailable</span>
      </div>
    );
  }
  return (
    <img src={src} alt={name ? `${name} (${sku}), product photo` : m.alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailedSrc(src)} data-testid={`img-product-${sku}`} className={cn('object-cover', className)} />
  );
}
