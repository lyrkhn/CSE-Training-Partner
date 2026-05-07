import { assessments } from "@/lib/mock-data";

// Future API seam: connect to an AI evaluation service once scoring is automated.
export async function listEvaluations() {
  return Promise.resolve(assessments);
}
