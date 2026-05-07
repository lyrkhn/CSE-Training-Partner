import { dashboardStats, milestones, profileMetrics, upcomingSessions } from "@/lib/mock-data";

// Future API seam: aggregate learner progress, milestones, and dashboard widgets.
export async function getProgressOverview() {
  return Promise.resolve({
    dashboardStats,
    milestones,
    profileMetrics,
    upcomingSessions,
  });
}
