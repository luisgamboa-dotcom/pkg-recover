import { Link } from 'react-router-dom';
import { cop, discountPct } from '../lib/format';
import type { Lot } from '../data/shop';

export function ConfigNotice() {
  return (
    <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4">
      Vista lista, sin datos: copia <code>web/.env.example</code> a{' '}
      <code>web/.env</code> con la anon key y aplica las migraciones en
      Supabase (reinicia opencode para reconectar el MCP).
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
export function LotBadges({ lot }: { lot: Lot }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {lot.is_verified && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-white bg-success-600 rounded-full px-2.5 py-0.5">
          ✓ Verificado
        </span>
      )}
      {lot.packaging_state === 'original' && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-2.5 py-0.5">
          Sellado
        </span>
      )}
      {lot.packaging_state === 'damaged' && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-950 bg-slate-200 rounded-full px-2.5 py-0.5">
          Caja dañada
        </span>
      )}
      {lot.packaging_state === 'no_box' && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-950 bg-slate-200 rounded-full px-2.5 py-0.5">
          Sin caja
        </span>
      )}
      {(() => {
        const d = discountPct(lot.base_price, lot.msrp_reference);
        return d != null ? (
          <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-accent-500 rounded-full px-2.5 py-0.5">
            −{d}%
          </span>
        ) : null;
      })()}
    </div>
  );
}

export function LotImage({
  lot,
  className,
}: {
  lot: Lot;
  className?: string;
}) {
  const src = lot.imageUrls[0];
  if (!src) {
    return (
      <div
        className={`grid place-items-center bg-brand-100 text-brand-900 font-extrabold ${className ?? ''}`}
        aria-label={`Sin foto: ${lot.title}`}
      >
        <span className="text-center px-2">
          <span className="block text-2xl">📦</span>
          <span className="block text-xs mt-1">{lot.sku}</span>
        </span>
      </div>
    );
  }
  return <img src={src} alt={lot.title} className={`object-cover ${className ?? ''}`} loading="lazy" />;
}

export function LotCard({ lot }: { lot: Lot }) {
  const d = discountPct(lot.base_price, lot.msrp_reference);
  return (
    <Link
      to={`/lotes/${lot.id}`}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-[0_10px_30px_rgba(26,54,93,0.12)] transition"
    >
      <div className="relative">
        <LotImage lot={lot} className="w-full aspect-square group-hover:scale-[1.02] transition" />
        {d != null && (
          <span className="absolute top-2 left-2 text-xs font-bold text-white bg-accent-500 rounded-full px-2.5 py-1">
            −{d}%
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-slate-400 font-mono">{lot.sku}</p>
        <h3 className="mt-0.5 font-bold text-brand-950 leading-snug line-clamp-2 min-h-[2.6em]">
          {lot.title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {lot.unit_count} uds · {lot.total_weight_kg} kg
          {lot.company ? ` · ${lot.company.name}` : ''}
        </p>
        <div className="mt-2">
          <LotBadges lot={lot} />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-brand-950">
            {cop(lot.base_price)}
          </span>
          {lot.msrp_reference != null && (
            <span className="text-sm text-slate-400 line-through">
              {cop(lot.msrp_reference)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
