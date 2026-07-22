import type { SavedFinalAssessment } from "@/src/lib/assessments/types";
import type { SafeAuthUser } from "@/src/lib/auth/userStore";

export function assessmentCompletionMinutes(assessment: SavedFinalAssessment) {
  const timestamps = assessment.transcript
    .map((entry) => new Date(entry.timestamp).getTime())
    .filter(Number.isFinite)
    .sort((first, second) => first - second);

  if (timestamps.length < 2) return null;
  return Math.max(0, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 60000));
}

export function analyticsForCourse(courseAssessments: SavedFinalAssessment[]) {
  const scores = courseAssessments.map((assessment) => assessment.overallScore);
  const passed = courseAssessments.filter((assessment) => assessment.outcome === "passed").length;
  const completionTimes = courseAssessments
    .map(assessmentCompletionMinutes)
    .filter((value): value is number => value !== null);
  const learnerBest = new Map<string, SavedFinalAssessment>();

  for (const assessment of courseAssessments) {
    const key = assessment.learnerId ?? assessment.learnerEmail ?? assessment.id;
    const existing = learnerBest.get(key);
    if (!existing || assessment.overallScore > existing.overallScore) {
      learnerBest.set(key, assessment);
    }
  }

  const scoreRanges = [
    { label: "0-59%", min: 0, max: 59 },
    { label: "60-79%", min: 60, max: 79 },
    { label: "80-89%", min: 80, max: 89 },
    { label: "90-100%", min: 90, max: 100 },
  ].map((range) => ({
    ...range,
    count: scores.filter((score) => score >= range.min && score <= range.max).length,
  }));

  return {
    totalAttempts: courseAssessments.length,
    passRate:
      courseAssessments.length === 0 ? null : Math.round((passed / courseAssessments.length) * 100),
    averageScore:
      scores.length === 0
        ? null
        : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length),
    averageCompletionTime:
      completionTimes.length === 0
        ? null
        : Math.round(
            completionTimes.reduce((total, minutes) => total + minutes, 0) /
              completionTimes.length,
          ),
    scoreRanges,
    topPerformers: [...learnerBest.values()]
      .sort((first, second) => second.overallScore - first.overallScore)
      .slice(0, 5),
  };
}

export function learnerName(assessment: SavedFinalAssessment, users: SafeAuthUser[]) {
  if (assessment.learnerName) return assessment.learnerName;
  if (assessment.learnerId) {
    return users.find((candidate) => candidate.id === assessment.learnerId)?.name ?? assessment.learnerId;
  }
  return "Unknown learner";
}

export function attemptNumberForAssessment(
  courseAssessments: SavedFinalAssessment[],
  assessment: SavedFinalAssessment,
) {
  return (
    courseAssessments
      .filter(
        (item) =>
          (item.learnerId && item.learnerId === assessment.learnerId) ||
          (!item.learnerId && item.learnerEmail === assessment.learnerEmail),
      )
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
      .findIndex((item) => item.id === assessment.id) + 1
  );
}
