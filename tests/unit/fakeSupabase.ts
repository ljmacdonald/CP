/**
 * Minimal thenable chain mock standing in for supabase-js's query builder.
 * `.from(table)...` calls all return the same chainable object regardless of
 * which methods (`.select`, `.eq`, `.insert`, `.update`, `.single`, …) are
 * chained; when awaited it resolves to the next queued `{ data, error }` for
 * that table. `.rpc(name, args)` resolves from a configured map, optionally
 * computed from the call args so a test can simulate a Postgres error code.
 */
export interface FakeResponse {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

export function createFakeSupabase(config: {
  from?: Record<string, FakeResponse[]>;
  rpc?: Record<string, FakeResponse | ((args: unknown) => FakeResponse)>;
}) {
  const queues: Record<string, FakeResponse[]> = {};
  for (const [table, responses] of Object.entries(config.from ?? {})) {
    queues[table] = [...responses];
  }

  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    const methods = [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "in",
      "order",
      "limit",
      "single",
      "maybeSingle",
    ];
    for (const method of methods) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: FakeResponse) => void, reject?: (e: unknown) => void) => {
      const queue = queues[table] ?? [];
      const next = queue.shift() ?? { data: null, error: null };
      try {
        return Promise.resolve(next).then(resolve, reject);
      } catch (err) {
        if (reject) reject(err);
        throw err;
      }
    };
    return chain;
  }

  return {
    from(table: string) {
      return makeChain(table);
    },
    rpc(name: string, args: unknown) {
      calls.push({ table: `rpc:${name}`, method: "rpc", args: [args] });
      const configured = config.rpc?.[name];
      const result =
        typeof configured === "function" ? configured(args) : configured ?? { data: null, error: null };
      return Promise.resolve(result);
    },
    _calls: calls,
  };
}
