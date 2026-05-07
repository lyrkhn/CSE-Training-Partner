import { transcriptEntries } from "@/lib/mock-data";

// Future API seam: store and retrieve transcript events from persistent storage.
export async function getSessionTranscript() {
  return Promise.resolve(transcriptEntries);
}
