import type { JournalEntry } from "./SessionJournal";

export function deduplicateJournalEntries(entries: JournalEntry[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }

    seen.add(entry.id);
    return true;
  });
}

export function highestJournalSequence(entries: JournalEntry[]) {
  return entries.reduce((highest, entry) => {
    const match = /^journal-(\d+)$/.exec(entry.id);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);
}
