import type { Database } from "@/lib/database.types";

type MutationError = { message: string } | null;
type MutationResult = Promise<{ error: MutationError }>;

type TableMutationQuery = {
  insert(values: unknown): MutationResult;
  upsert(values: unknown): MutationResult;
  update(values: unknown): {
    eq(column: string, value: string): MutationResult;
  };
  delete(): {
    eq(column: string, value: string): MutationResult;
  };
};

export function tableMutation(
  supabase: unknown,
  table: keyof Database["public"]["Tables"],
) {
  return (supabase as { from: (name: string) => unknown }).from(table) as TableMutationQuery;
}

export function rpcMutation(supabase: unknown) {
  const client = supabase as {
    rpc: (fn: string, args?: Record<string, unknown>) => MutationResult;
  };

  return client.rpc.bind(client) as (
    fn: keyof Database["public"]["Functions"],
    args?: Record<string, unknown>,
  ) => MutationResult;
}
