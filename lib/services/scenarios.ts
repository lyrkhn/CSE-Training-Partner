import { scenarios } from "@/lib/mock-data";

// Future API seam: replace this with fetch("/api/scenarios") or a typed SDK client.
export async function listScenarios() {
  return Promise.resolve(scenarios);
}
