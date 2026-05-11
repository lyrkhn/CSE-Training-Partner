export type NavItem = {
  title: string;
  href: string;
  icon: "dashboard" | "courses" | "simulation" | "assessment" | "profile" | "lab";
};

export type Scenario = {
  id: string;
  title: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  focus: string;
  description: string;
  completionRate: number;
  status: "Assigned" | "In Progress" | "Completed";
};

export type Assessment = {
  id: string;
  title: string;
  scenario: string;
  score: number;
  summary: string;
  coachNote: string;
  evaluatedAt: string;
  dimensions: Array<{
    label: string;
    value: number;
  }>;
};

export type TranscriptEntry = {
  id: string;
  speaker: "Learner" | "Customer" | "Coach";
  timestamp: string;
  message: string;
};

export type ProfileMetric = {
  label: string;
  value: string;
  helper: string;
};

export type LearningMilestone = {
  id: string;
  title: string;
  dueDate: string;
  status: "On Track" | "Needs Attention" | "Completed";
};
