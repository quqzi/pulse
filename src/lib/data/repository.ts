import { get } from 'svelte/store';
import { createRepository, type RepoConfig, type Repository, type Adapter } from '$lib/data/engine';
import { localAdapter } from '$lib/data/adapters/local';
import { supabaseAdapter } from '$lib/data/adapters/supabase';
import { authCtx } from '$lib/data/authctx';
import { toast } from '$lib/stores/toast';
import { t } from '$lib/i18n';
import { en } from '$lib/i18n/en';

/**
 * Surface a data-layer error as a localized toast. The pure engine emits its two
 * generic English messages (en.common.errSave / errDelete); we map those to the
 * active language here at the display boundary, keeping the engine i18n-free.
 */
export function reportError(m: string): void {
  const tr = get(t);
  if (m === en.common.errSave) toast.error(tr.common.errSave);
  else if (m === en.common.errDelete) toast.error(tr.common.errDelete);
  else toast.error(m);
}

export interface EntityConfig<T extends { id: string }> extends RepoConfig<T> {
  lsKey: string;
  table: string;
  toRow: (item: T) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
  orderColumn?: string;
  ascending?: boolean;
}

/** Binds the pure engine to real deps: authCtx for mode/userId, toast for errors, local/supabase adapters. */
export function repo<T extends { id: string }>(cfg: EntityConfig<T>): Repository<T> {
  const local = localAdapter<T>(cfg.lsKey);
  const cloud = (userId: string): Adapter<T> =>
    supabaseAdapter<T>({
      table: cfg.table,
      userId,
      toRow: cfg.toRow,
      fromRow: cfg.fromRow,
      orderColumn: cfg.orderColumn,
      ascending: cfg.ascending,
    });

  return createRepository<T>(
    { store: cfg.store, order: cfg.order },
    {
      getMode: () => get(authCtx).mode,
      selectAdapter: (mode) => (mode === 'guest' ? local : cloud(get(authCtx).userId)),
      onError: reportError,
    },
  );
}
