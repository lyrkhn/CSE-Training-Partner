import type { TranscriptEntry } from "@/src/lib/transcripts/types";
import type { TranscriptTurn } from "@/src/lib/assessments/types";

function buildTurnId(speakerType: TranscriptTurn["speaker_type"], entryIds: string[]) {
  return `${speakerType}-${entryIds.join("-")}`;
}

export function groupTranscriptTurns(transcript: TranscriptEntry[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];

  for (const entry of transcript) {
    const previousTurn = turns[turns.length - 1];

    if (previousTurn && previousTurn.speaker_type === entry.speaker_type) {
      previousTurn.text = [previousTurn.text, entry.text].filter(Boolean).join(" ").trim();
      previousTurn.endedAt = entry.timestamp;
      previousTurn.entryIds.push(entry.id);
      previousTurn.id = buildTurnId(previousTurn.speaker_type, previousTurn.entryIds);
      continue;
    }

    turns.push({
      id: buildTurnId(entry.speaker_type, [entry.id]),
      speaker_type: entry.speaker_type,
      speaker_id: entry.speaker_id,
      text: entry.text.trim(),
      startedAt: entry.timestamp,
      endedAt: entry.timestamp,
      entryIds: [entry.id],
    });
  }

  return turns;
}

