import type { JournalEntry } from "../components/SessionJournal";
import { supabase } from "./client";

export interface ModelingDraft {
  graphId: string | null;
  graphName: string;
  graphXml: string;
  journalEntries: JournalEntry[];
  updatedAt: string;
}

type ModelingDraftRow = {
  graph_id: string | null;
  graph_name: string;
  xml: string;
  journal_entries: JournalEntry[] | null;
  updated_at: string;
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

function rowToDraft(row: ModelingDraftRow): ModelingDraft {
  return {
    graphId: row.graph_id,
    graphName: row.graph_name,
    graphXml: row.xml,
    journalEntries: row.journal_entries ?? [],
    updatedAt: row.updated_at,
  };
}

export async function loadRemoteModelingDraft(): Promise<ModelingDraft | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("modeling_drafts")
    .select("graph_id,graph_name,xml,journal_entries,updated_at")
    .limit(1);

  if (error) {
    throw error;
  }

  const row = (data?.[0] ?? null) as ModelingDraftRow | null;

  return row ? rowToDraft(row) : null;
}

export async function saveRemoteModelingDraft(
  graphId: string | null,
  graphName: string,
  graphXml: string,
  journalEntries: JournalEntry[],
) {
  const client = requireSupabase();
  const userId = await getCurrentUserId();
  const { error } = await client.from("modeling_drafts").upsert(
    {
      user_id: userId,
      graph_id: graphId,
      graph_name: graphName,
      xml: graphXml,
      journal_entries: journalEntries,
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    throw error;
  }
}
