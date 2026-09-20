import { requireSupabase } from '../lib/supabase';

/** Empresas donde el usuario es miembro + su resumen de recuperación. */
export async function fetchMyCompanies(userId: string) {
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
  const { data, error } = await requireSupabase()
    .from('packages')
    .select('id, received_at, origin, total_units, total_weight_kg, status, notes')
    .eq('company_id', companyId)
    .order('received_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCompanyLots(companyId: string) {
  const { data, error } = await requireSupabase()
    .from('lots')
    .select('id, sku, title, status, stock_quantity, base_price, unit_count')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCompanySales(companyId: string) {
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
