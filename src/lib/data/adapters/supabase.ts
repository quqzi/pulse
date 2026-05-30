import { supabase } from '$lib/supabase';
import type { Adapter } from '$lib/data/engine';

export interface SupabaseAdapterConfig<T> {
  table: string;
  userId: string;
  toRow: (item: T) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
  orderColumn?: string;
  ascending?: boolean;
}

export function supabaseAdapter<T extends { id: string }>(cfg: SupabaseAdapterConfig<T>): Adapter<T> {
  return {
    async list() {
      let q = supabase.from(cfg.table).select('*').eq('user_id', cfg.userId);
      if (cfg.orderColumn) q = q.order(cfg.orderColumn, { ascending: cfg.ascending ?? true });
      const { data, error } = await q;
      if (error) throw error; // engine.load() catches -> read-empty-on-error (store unchanged)
      return (data ?? []).map(cfg.fromRow);
    },
    async save(item) {
      const { error } = await supabase.from(cfg.table).upsert(cfg.toRow(item));
      if (error) throw error; // engine.save() catches -> rollback + toast
    },
    async remove(id) {
      const { error } = await supabase.from(cfg.table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}
