import type { DCRGraphEntry, DCRGraphRepository } from "../App";
import { supabase } from "./client";

type GraphRow = {
  id: string;
  name: string;
  xml: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

export function graphRowsToRepository(rows: GraphRow[]): DCRGraphRepository {
  return new Map(
    rows.map((row) => [
      row.name,
      {
        id: row.id,
        name: row.name,
        graph: row.xml,
      },
    ]),
  );
}

export async function loadRemoteGraphs(): Promise<DCRGraphRepository> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("graphs")
    .select("id,name,xml")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return graphRowsToRepository((data ?? []) as GraphRow[]);
}

export async function saveRemoteGraph(
  userId: string,
  name: string,
  graph: string,
): Promise<DCRGraphEntry> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("graphs")
    .upsert(
      {
        owner_id: userId,
        name,
        xml: graph,
      },
      {
        onConflict: "owner_id,name",
      },
    )
    .select("id,name,xml")
    .single();

  if (error) {
    throw error;
  }

  const row = data as GraphRow;

  const { error: versionError } = await client.from("graph_versions").insert({
    graph_id: row.id,
    created_by: userId,
    xml: graph,
    summary: "Saved graph",
  });

  if (versionError) {
    throw versionError;
  }

  return {
    id: row.id,
    name: row.name,
    graph: row.xml,
  };
}
