import { requireSupabase } from '../lib/supabase';
import { getDb, isDemo, saveDb } from '../demo/demo';

/** Empresas donde el usuario es miembro + su resumen de recuperación. */
export async function fetchMyCompanies(userId: string) {
  if (isDemo()) {
    const db = getDb();
    const mine = (db.company_members as any[]).filter((m) => m.profile_id === userId);
    return mine
      .map((m) => {
        const c = (db.companies as any[]).find((x) => x.id === m.company_id);
        if (!c) return null;
        const lots = (db.lots as any[]).filter((l) => l.company_id === c.id);
        const lotIds = new Set(lots.map((l) => l.id));
        const items: any[] = [];
        for (const o of db.orders as any[]) {
          if (['cancelled', 'returned'].includes(o.status)) continue;
          for (const i of o.order_items ?? []) {
            if (lotIds.has(i.lots?.id)) items.push(i);
          }
        }
        return {
          ...c,
          company_role: m.company_role,
          stats: {
            packages_received: (db.packages as any[]).filter((p) => p.company_id === c.id).length,
            lots_published: lots.filter((l) => l.status === 'published').length,
            revenue_recovered: items.reduce((a, i) => a + Number(i.line_total), 0),
            lots_sold: items.reduce((a, i) => a + i.quantity, 0),
          },
        };
      })
      .filter(Boolean);
  }
  const sb = requireSupabase();
  const { data: memberships, error } = await sb
    .from('company_members')
    .select('company_role, companies (id, name, verification_code, is_verified, city)')
    .eq('profile_id', userId);
  if (error) throw error;
  const companies = ((memberships ?? []) as any[])
    .map((m) => ({ ...m.companies, company_role: m.company_role }))
    .filter((c) => c.id);
  const out = [];
  for (const c of companies) {
    const { data: stats } = await sb
      .from('v_company_recovery')
      .select('*')
      .eq('company_id', c.id)
      .maybeSingle();
    out.push({ ...c, stats: (stats as any) ?? null });
  }
  return out as any[];
}

export async function fetchCompanyPackages(companyId: string) {
  if (isDemo()) {
    return (getDb().packages as any[])
      .filter((p) => p.company_id === companyId)
      .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)));
  }
  const { data, error } = await requireSupabase()
    .from('packages')
    .select('id, received_at, origin, total_units, total_weight_kg, status, notes')
    .eq('company_id', companyId)
    .order('received_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCompanyLots(companyId: string) {
  if (isDemo()) {
    return (getDb().lots as any[])
      .filter((l) => l.company_id === companyId)
      .map((l) => ({
        id: l.id,
        sku: l.sku,
        title: l.title,
        status: l.status,
        stock_quantity: l.stock_quantity,
        base_price: l.base_price,
        unit_count: l.unit_count,
      }));
  }
  const { data, error } = await requireSupabase()
    .from('lots')
    .select('id, sku, title, status, stock_quantity, base_price, unit_count')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCompanySales(companyId: string) {
  if (isDemo()) {
    const db = getDb();
    const lotIds = new Set(
      (db.lots as any[]).filter((l) => l.company_id === companyId).map((l) => l.id),
    );
    const rows: any[] = [];
    for (const o of db.orders as any[]) {
      for (const i of o.order_items ?? []) {
        if (!lotIds.has(i.lots?.id)) continue;
        rows.push({
          quantity: i.quantity,
          line_total: i.line_total,
          orders: { order_number: o.order_number, status: o.status, created_at: o.created_at },
          lots: i.lots,
        });
      }
    }
    return rows.sort((a, b) => String(b.orders.created_at).localeCompare(String(a.orders.created_at)));
  }
  const { data, error } = await requireSupabase()
    .from('order_items')
    .select('quantity, line_total, orders!inner (order_number, status, created_at), lots!inner (sku, title, company_id)')
    .eq('lots.company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function registerCompanyPackage(userId: string, companyId: string, input: any) {
  if (isDemo()) {
    const db = getDb();
    const member = (db.company_members as any[]).find(
      (m) => m.company_id === companyId && m.profile_id === userId,
    );
    if (!member) throw new Error('No perteneces a esa empresa.');
    const nid = `demo-pkg-${Date.now()}`;
    const company = (db.companies as any[]).find((c) => c.id === companyId);
    (db.packages as any[]).unshift({
      id: nid,
      company_id: companyId,
      received_at: new Date().toISOString(),
      companies: { name: company?.name ?? '' },
      ...input,
    });
    saveDb(db);
    return nid;
  }
  const sb = requireSupabase();
  const { data: member } = await sb
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', userId)
    .maybeSingle();
  if (!member) throw new Error('No perteneces a esa empresa.');
  const { data, error } = await sb
    .from('packages')
    .insert({ company_id: companyId, ...input })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('No se registró el paquete');
  return (data as { id: string }).id;
}
