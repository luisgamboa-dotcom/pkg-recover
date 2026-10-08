import { Link } from 'react-router-dom';
import { clp, discountPct } from '../lib/format';
import type { Product } from '../data/shop';

export function ConfigNotice() {
  return (
    <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4">
      No pudimos cargar los datos en este momento. Inténtalo más tarde o
      contáctanos por <Link to="/ayuda">ayuda</Link>.
    </p>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h3 className="font-bold text-brand-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

/** Insignias de condición unificadas (Stitch mezclaba Verified/Sealed/Damaged). */
export function ProductBadges({ product }: { product: Product }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {product.is_verified && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white bg-success-600 rounded-full px-2.5 py-0.5">
          ✓ Verificado
        </span>
      )}
      {product.packaging_state === 'original' && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-2.5 py-0.5">
          Sellado
        </span>
      )}
      {product.packaging_state === 'damaged' && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-950 bg-slate-200 rounded-full px-2.5 py-0.5">
          Caja dañada
        </span>
      )}
      {product.packaging_state === 'no_box' && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-950 bg-slate-200 rounded-full px-2.5 py-0.5">
          Sin caja
        </span>
      )}
      {(() => {
        const d = discountPct(product.base_price, product.msrp_reference);
        return d != null ? (
          <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-accent-500 rounded-full px-2.5 py-0.5">
            −{d}%
          </span>
        ) : null;
      })()}
    </div>
  );
}

export function ProductImage({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const src = product.imageUrls[0];
  if (!src) {
    return (
      <div
        className={`grid place-items-center bg-brand-100 text-brand-900 font-extrabold ${className ?? ''}`}
        aria-label={`Sin foto: ${product.title}`}
      >
        <span className="text-center px-2">
          <span className="block text-2xl">📦</span>
          <span className="block text-xs mt-1">{product.sku}</span>
        </span>
      </div>
    );
  }
  return <img src={src} alt={product.title} className={`object-cover ${className ?? ''}`} loading="lazy" />;
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" aria-hidden>
      <div className="skeleton w-full aspect-square" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-6 w-1/2 rounded" />
      </div>
    </div>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const d = discountPct(product.base_price, product.msrp_reference);
  return (
    <Link
      to={`/productos/${product.id}`}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-[0_16px_40px_rgba(26,54,93,0.16)] hover:-translate-y-1 hover:border-brand-100 transition-all duration-300"
    >
      <div className="relative overflow-hidden">
        <ProductImage product={product} className="w-full aspect-square group-hover:scale-105 transition-transform duration-500" />
        {d != null && (
          <span className="absolute top-2 left-2 text-xs font-bold text-white bg-accent-500 rounded-full px-2.5 py-1">
            −{d}%
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-slate-400 font-mono">{product.sku}</p>
        <h3 className="mt-0.5 font-bold text-brand-950 leading-snug line-clamp-2 min-h-[2.6em]">
          {product.title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {product.unit_count} uds · {product.total_weight_kg} kg
          {product.company ? ` · ${product.company.name}` : ''}
        </p>
        <div className="mt-2">
          <ProductBadges product={product} />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-brand-950">
            {clp(product.base_price)}
          </span>
          {product.msrp_reference != null && (
            <span className="text-sm text-slate-400 line-through">
              {clp(product.msrp_reference)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
