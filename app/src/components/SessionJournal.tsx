import { useState } from "react";
import styled from "styled-components";
import Button from "../utilComponents/Button";

export type JournalEntryKind =
  | "opened"
  | "created"
  | "deleted"
  | "updated"
  | "note";

export interface JournalEntry {
  id: string;
  timestamp: string;
  kind: JournalEntryKind;
  title: string;
  summary: string;
  elementId?: string;
  elementType?: string;
  note: string;
  userCreated?: boolean;
}

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.15rem;
`;

const AddButton = styled(Button)`
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
`;

const EmptyText = styled.div`
  color: #555;
`;

const EntryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const EntryCard = styled.article`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.7rem;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: white;
`;

const EntryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
`;

const EntryTitle = styled.strong`
  font-size: 0.95rem;
`;

const EntryTime = styled.time`
  flex: 0 0 auto;
  color: #555;
  font-size: 0.78rem;
`;

const EntrySummary = styled.div`
  color: #333;
  font-size: 0.9rem;
  line-height: 1.35;
`;

const NoteInput = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  min-height: 4.5rem;
  padding: 0.5rem;
  border: 1px solid #aaa;
  border-radius: 4px;
  resize: vertical;
  font: inherit;
  font-size: 0.9rem;
`;

const EntryActions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const SmallButton = styled.button`
  padding: 0.35rem 0.45rem;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  background: white;
  color: black;
  font: inherit;
  font-size: 0.82rem;

  &:hover {
    border-color: black;
  }
`;

interface SessionJournalProps {
  entries: JournalEntry[];
  onAddNote: (note: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onUpdateNote: (entryId: string, note: string) => void;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SessionJournal({
  entries,
  onAddNote,
  onDeleteEntry,
  onUpdateNote,
}: SessionJournalProps) {
  const [draftNote, setDraftNote] = useState("");

  const addNote = () => {
    const note = draftNote.trim();
    if (!note) {
      return;
    }

    onAddNote(note);
    setDraftNote("");
  };

  return (
    <>
      <Header>
        <Title>Session Journal</Title>
        <AddButton onClick={addNote} type="button">
          New note
        </AddButton>
      </Header>

      <NoteInput
        aria-label="New session note"
        onChange={(event) => setDraftNote(event.target.value)}
        placeholder="Write a session note..."
        value={draftNote}
      />

      {entries.length === 0 ? (
        <EmptyText>No session changes yet.</EmptyText>
      ) : (
        <EntryList>
          {entries.map((entry) => (
            <EntryCard key={entry.id}>
              <EntryHeader>
                <EntryTitle>{entry.title}</EntryTitle>
                <EntryTime dateTime={entry.timestamp}>
                  {formatTime(entry.timestamp)}
                </EntryTime>
              </EntryHeader>
              <EntrySummary>{entry.summary}</EntrySummary>
              <NoteInput
                aria-label={`Note for ${entry.title}`}
                onChange={(event) => onUpdateNote(entry.id, event.target.value)}
                placeholder="Add a note about this change..."
                value={entry.note}
              />
              <EntryActions>
                {entry.note && (
                  <SmallButton onClick={() => onUpdateNote(entry.id, "")} type="button">
                    Clear note
                  </SmallButton>
                )}
                {entry.userCreated && (
                  <SmallButton onClick={() => onDeleteEntry(entry.id)} type="button">
                    Delete
                  </SmallButton>
                )}
              </EntryActions>
            </EntryCard>
          ))}
        </EntryList>
      )}
    </>
  );
}

export default SessionJournal;
