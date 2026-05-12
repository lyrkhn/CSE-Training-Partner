export type NormalizedTranscript = {
  id: string;
  speaker_type: "engineer" | "customer_ai";
  speaker_id: string;
  text: string;
  timestamp: string;
};

export type ToolkitTranscriptMetadata = {
  object?: string;
  user_id?: string;
  stream_id?: number;
  turn_id?: number;
};

export type ToolkitTranscriptItem = {
  uid: string;
  stream_id: number;
  turn_id: number;
  _time: number;
  text: string;
  status: number;
  metadata: ToolkitTranscriptMetadata | null;
};

type TranscriptMapperContext = {
  traineeUid?: string;
  agentUid?: string;
};

function inferSpeakerType(
  item: ToolkitTranscriptItem,
  context: TranscriptMapperContext,
): "engineer" | "customer_ai" {
  const objectType = item.metadata?.object;
  if (objectType === "assistant.transcription") {
    return "customer_ai";
  }
  if (objectType === "user.transcription") {
    return "engineer";
  }

  if (context.agentUid && item.uid === context.agentUid) {
    return "customer_ai";
  }
  if (context.traineeUid && item.uid === context.traineeUid) {
    return "engineer";
  }

  if (item.stream_id === 0) {
    return "customer_ai";
  }
  return "engineer";
}

export function mapToolkitTranscriptItem(
  item: ToolkitTranscriptItem,
  context: TranscriptMapperContext,
): NormalizedTranscript | null {
  const text = item.text.trim();
  if (!text) {
    return null;
  }

  const speakerType = inferSpeakerType(item, context);
  const speakerId =
    speakerType === "customer_ai"
      ? context.agentUid || item.uid || "customer_ai"
      : context.traineeUid || item.metadata?.user_id || item.uid || "engineer";

  return {
    id: `${speakerType}-${item.turn_id}-${item.stream_id}`,
    speaker_type: speakerType,
    speaker_id: speakerId,
    text,
    timestamp: new Date(item._time).toISOString(),
  };
}

export function mapToolkitTranscriptItems(
  items: ToolkitTranscriptItem[],
  context: TranscriptMapperContext,
): NormalizedTranscript[] {
  return items
    .map((item) => mapToolkitTranscriptItem(item, context))
    .filter((item): item is NormalizedTranscript => Boolean(item));
}
