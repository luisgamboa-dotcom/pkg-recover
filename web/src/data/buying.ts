import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { isUuid } from '../lib/validation';
import type { Filters } from './shop';

// ---------------------------------------------------------------- alertas
export function usePriceAlert(productId: string | undefined, userId: string | undefined) {
  const [alert, setAlert] = useState<{ target_price: number; is_active: boolean } | null>(null);
  const refresh = useCallback(() => {
    if (!productId || !userId || !isSupabaseConfigured) return;
    requireSupabase()
      .from('price_alerts')
      .select('target_price, is_active')
      .eq('product_id', productId)
      .eq('profile_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAlert(data as any);
      });
  }, [productId, userId]);

  useEffect(refresh, [refresh]);

  const save = useCallback(
    async (targetPrice: number) => {
      if (!productId || !userId) return;
      const { error } = await requireSupabase()
        .from('price_alerts')
        .upsert(
          { product_id: productId, profile_id: userId, target_price: targetPrice, is_active: true },
          { onConflict: 'profile_id,product_id' },
        );
      if (error) throw error;
      refresh();
    },
    [productId, userId, refresh],
  );

  return { alert, save };
}

// ---------------------------------------------------------------- ofertas
export interface Offer {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  amount: number;
  message: string | null;
  status: string;
  created_at: string;
  products?: { title: string; sku: string } | null;
}

export async function createOffer(productId: string, buyerId: string, amount: number, quantity: number, message: string | null) {
  const { error } = await requireSupabase()
    .from('offers')
    .insert({ product_id: productId, buyer_id: buyerId, amount, quantity, message });
  if (error) throw error;
}

export function useMyOffers(userId: string | undefined) {
  const [items, setItems] = useState<Offer[]>([]);
  const refresh = useCallback(() => {
    if (!userId || !isSupabaseConfigured) return;
    requireSupabase()
      .from('offers')
      .select('id, product_id, buyer_id, quantity, amount, message, status, created_at, products (title, sku)')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data as any[]);
      });
  }, [userId]);
  useEffect(refresh, [refresh]);
  return { items, refresh };
}

/** Ofertas recibidas para los productos de una empresa. */
export function useCompanyOffers(companyId: string | undefined) {
  const [items, setItems] = useState<Offer[]>([]);
  const refresh = useCallback(() => {
    if (!companyId || !isSupabaseConfigured) return;
    requireSupabase()
      .from('offers')
      .select('id, product_id, buyer_id, quantity, amount, message, status, created_at, products!inner (title, sku, company_id)')
      .eq('products.company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setItems(data as any[]);
      });
  }, [companyId]);
  useEffect(refresh, [refresh]);

  const respond = useCallback(
    async (offerId: string, accept: boolean) => {
      const { error } = await requireSupabase()
        .from('offers')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', offerId)
        .eq('status', 'pending');
      if (error) throw error;
      refresh();
    },
    [refresh],
  );

  return { items, refresh, respond };
}

/** Convierte una oferta aceptada en pedido pendiente de pago. */
export async function convertOffer(offerId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('convert_offer_to_order', { p_offer_id: offerId });
  if (error) throw error;
  return data as string;
}

// ---------------------------------------------------------------- subastas
export interface Auction {
  id: string;
  product_id: string;
  starting_price: number;
  current_bid: number | null;
  current_bidder: string | null;
  ends_at: string;
  status: string;
  products?: { title: string; sku: string } | null;
}

export function useActiveAuction(productId: string | undefined) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const refresh = useCallback(() => {
    if (!productId || !isUuid(productId) || !isSupabaseConfigured) return;
    requireSupabase()
      .from('auctions')
      .select('id, product_id, starting_price, current_bid, current_bidder, ends_at, status')
      .eq('product_id', productId)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => setAuction((data as Auction | null) ?? null));
  }, [productId]);
  useEffect(refresh, [refresh]);
  return { auction, refresh };
}

export function useActiveAuctions() {
  const [items, setItems] = useState<Auction[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('auctions')
      .select('id, product_id, starting_price, current_bid, ends_at, status, products (title, sku)')
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .order('ends_at')
      .limit(8)
      .then(({ data }) => {
        if (data) setItems(data as any[]);
      });
  }, []);
  return items;
}

export async function placeBid(auctionId: string, bidderId: string, amount: number) {
  const { error } = await requireSupabase()
    .from('auction_bids')
    .insert({ auction_id: auctionId, bidder_id: bidderId, amount });
  if (error) throw error;
}

export async function createAuction(productId: string, startingPrice: number, endsAt: string) {
  const { error } = await requireSupabase()
    .from('auctions')
    .insert({ product_id: productId, starting_price: startingPrice, ends_at: endsAt });
  if (error) throw error;
}

export async function closeAuction(auctionId: string) {
  const { error } = await requireSupabase()
    .from('auctions')
    .update({ status: 'closed' })
    .eq('id', auctionId);
  if (error) throw error;
}

// ---------------------------------------------------------------- filtros
export function useSavedFilters(userId: string | undefined) {
  const [items, setItems] = useState<{ id: string; name: string; filters: Partial<Filters> }[]>([]);
  const refresh = useCallback(() => {
    if (!userId || !isSupabaseConfigured) return;
    requireSupabase()
      .from('saved_filters')
      .select('id, name, filters')
      .eq('profile_id', userId)
      .order('created_at')
      .then(({ data }) => {
        if (data) setItems(data as any[]);
      });
  }, [userId]);
  useEffect(refresh, [refresh]);

  const save = useCallback(
    async (name: string, filters: Filters) => {
      if (!userId) return;
      const { error } = await requireSupabase()
        .from('saved_filters')
        .upsert({ profile_id: userId, name, filters }, { onConflict: 'profile_id,name' });
      if (error) throw error;
      refresh();
    },
    [userId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await requireSupabase().from('saved_filters').delete().eq('id', id);
      if (error) throw error;
      refresh();
    },
    [refresh],
  );

  return { items, save, remove };
}
