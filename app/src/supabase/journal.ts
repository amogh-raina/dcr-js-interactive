import type { JournalEntry } from "../components/SessionJournal";
import { supabase } from "./client";

type JournalRow = {
  client_id: string;
  change_type: JournalEntry["kind"];
  title: string;
  element_id: string | null;
  element_type: string | null;
  summary: string;
  note: string;
  user_created: boolean;
  created_at: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

async function getCurrentUserId() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("No signed-in user.");
  }

  return data.user.id;
}

function rowToEntry(row: JournalRow): JournalEntry {
  return {
    id: row.client_id,
    timestamp: row.created_at,
    kind: row.change_type,
    title: row.title,
    summary: row.summary,
    elementId: row.element_id ?? undefined,
    elementType: row.element_type ?? undefined,
    note: row.note,
    userCreated: row.user_created,
  };
}

function entryToRow(
  graphId: string,
  entry: JournalEntry,
): Omit<JournalRow, "created_at"> & {
  graph_id: string;
} {
  return {
    client_id: entry.id,
    graph_id: graphId,
    change_type: entry.kind,
    title: entry.title,
    element_id: entry.elementId ?? null,
    element_type: entry.elementType ?? null,
    summary: entry.summary,
    note: entry.note,
    user_created: entry.userCreated ?? false,
  };
}

export async function loadRemoteJournalEntries(
  graphId: string,
): Promise<JournalEntry[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("journal_entries")
    .select(
      "client_id,change_type,title,element_id,element_type,summary,note,user_created,created_at",
    )
    .eq("graph_id", graphId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as JournalRow[]).map(rowToEntry);
}

export async function upsertRemoteJournalEntries(
  graphId: string,
  entries: JournalEntry[],
) {
  if (entries.length === 0) {
    return;
  }

  const client = requireSupabase();
  const userId = await getCurrentUserId();
  const { error } = await client.from("journal_entries").upsert(
    entries.map((entry) => ({
      ...entryToRow(graphId, entry),
      user_id: userId,
    })),
    {
      onConflict: "graph_id,client_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function updateRemoteJournalNote(
  graphId: string,
  clientId: string,
  note: string,
) {
  const client = requireSupabase();
  const { error } = await client
    .from("journal_entries")
    .update({ note })
    .eq("graph_id", graphId)
    .eq("client_id", clientId);

  if (error) {
    throw error;
  }
}

export async function deleteRemoteJournalEntry(
  graphId: string,
  clientId: string,
) {
  const client = requireSupabase();
  const { error } = await client
    .from("journal_entries")
    .delete()
    .eq("graph_id", graphId)
    .eq("client_id", clientId);

  if (error) {
    throw error;
  }
}
