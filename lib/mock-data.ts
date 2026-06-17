import type {
  Assessment,
  LearningMilestone,
  NavItem,
  ProfileMetric,
  Scenario,
  TranscriptEntry,
} from "@/lib/types";

export const navigationItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: "dashboard" },
  { title: "Simulation Courses", href: "/courses", icon: "courses" },
  { title: "Simulation Session", href: "/simulation", icon: "simulation", allowedRoles: ["trainee"] },
  {
    title: "Course Builder",
    href: "/course-builder",
    icon: "builder",
    allowedRoles: ["root_admin", "course_admin"],
    children: [
      {
        title: "Preview Created Courses",
        href: "/course-builder",
        allowedRoles: ["root_admin", "course_admin"],
      },
      {
        title: "Role Play Builder",
        href: "/course-builder/new",
        allowedRoles: ["root_admin", "course_admin"],
      },
    ],
  },
  { title: "Assessment Results", href: "/assessment", icon: "assessment" },
  {
    title: "Control Panel",
    href: "/control-panel",
    icon: "control",
    allowedRoles: ["root_admin"],
    children: [
      {
        title: "User Management",
        href: "/control-panel/users",
        allowedRoles: ["root_admin"],
      },
      {
        title: "Course List",
        href: "/control-panel/courses",
        allowedRoles: ["root_admin"],
      },
    ],
  },
  { title: "Profile", href: "/profile", icon: "profile" },
];

export const scenarios: Scenario[] = [
  {
    id: "scenario-01",
    title: "Escalated Billing Dispute",
    category: "De-escalation",
    difficulty: "Intermediate",
    duration: "18 min",
    focus: "Expectation setting and calm escalation handling",
    description:
      "Guide an upset enterprise customer through invoice discrepancies while preserving trust and documenting next actions.",
    completionRate: 72,
    status: "Assigned",
  },
  {
    id: "scenario-02",
    title: "RTC Call Quality Triage",
    category: "Diagnostics",
    difficulty: "Advanced",
    duration: "24 min",
    focus: "Packet loss investigation and reproduction steps",
    description:
      "Investigate a multi-region call quality complaint, isolate telemetry signals, and recommend the fastest path to mitigation.",
    completionRate: 54,
    status: "In Progress",
  },
  {
    id: "scenario-03",
    title: "Auth Token Expiry Walkthrough",
    category: "Product Guidance",
    difficulty: "Beginner",
    duration: "12 min",
    focus: "Discovery questioning and customer education",
    description:
      "Coach a developer through recurring token expiry errors and help them verify renewal logic without overloading them with jargon.",
    completionRate: 91,
    status: "Completed",
  },
];

export const assessments: Assessment[] = [
  {
    id: "assessment-01",
    title: "AI Evaluation: Call Quality Triage",
    scenario: "RTC Call Quality Triage",
    score: 88,
    summary:
      "Strong technical reasoning with clear communication. The next growth area is narrowing the first reproduction hypothesis sooner.",
    coachNote:
      "You guided the customer well and used evidence-based language. Push toward a firmer diagnostic structure in the first five minutes.",
    evaluatedAt: "May 6, 2026",
    dimensions: [
      { label: "Technical Diagnosis", value: 91 },
      { label: "Communication Clarity", value: 87 },
      { label: "Customer Empathy", value: 90 },
      { label: "Action Planning", value: 83 },
    ],
  },
  {
    id: "assessment-02",
    title: "AI Evaluation: Billing Dispute",
    scenario: "Escalated Billing Dispute",
    score: 82,
    summary:
      "Solid de-escalation and expectation setting. Opportunity remains around confirming ownership and timeline commitments.",
    coachNote:
      "Your tone stayed calm and grounded. Add a clearer recap before closing to strengthen customer confidence.",
    evaluatedAt: "May 4, 2026",
    dimensions: [
      { label: "Technical Diagnosis", value: 76 },
      { label: "Communication Clarity", value: 84 },
      { label: "Customer Empathy", value: 92 },
      { label: "Action Planning", value: 79 },
    ],
  },
];

export const transcriptEntries: TranscriptEntry[] = [
  {
    id: "line-01",
    speaker: "Customer",
    timestamp: "00:45",
    message:
      "Our users in Singapore are seeing audio break up every few minutes, and support has asked me for logs three times already.",
  },
  {
    id: "line-02",
    speaker: "Learner",
    timestamp: "01:14",
    message:
      "I hear the frustration there. Let me quickly confirm whether this is isolated to one SDK version or if multiple client builds are affected.",
  },
  {
    id: "line-03",
    speaker: "Customer",
    timestamp: "02:08",
    message:
      "It started after we rolled out a new Android release, but the iOS team reported one case too.",
  },
  {
    id: "line-04",
    speaker: "Coach",
    timestamp: "02:11",
    message:
      "Good validation step. Next, ask for impact scope and recent configuration changes to sharpen your reproduction path.",
  },
];

export const profileMetrics: ProfileMetric[] = [
  { label: "Scenarios Completed", value: "28", helper: "+4 this week" },
  { label: "Average Assessment", value: "86%", helper: "Top 12% cohort" },
  { label: "Live Sim Hours", value: "41h", helper: "8h with AI coach" },
  { label: "Certification Path", value: "Level 2", helper: "2 modules left" },
];

export const milestones: LearningMilestone[] = [
  {
    id: "mile-01",
    title: "Finish advanced diagnostics simulation pack",
    dueDate: "May 12, 2026",
    status: "On Track",
  },
  {
    id: "mile-02",
    title: "Retake de-escalation assessment with target 90%",
    dueDate: "May 15, 2026",
    status: "Needs Attention",
  },
  {
    id: "mile-03",
    title: "Complete customer empathy certification review",
    dueDate: "May 18, 2026",
    status: "Completed",
  },
];

export const dashboardStats = [
  { label: "Completion", value: "74%", helper: "12 active modules" },
  { label: "Current Streak", value: "9 days", helper: "Consistency target met" },
  { label: "Upcoming Reviews", value: "3", helper: "Next on May 8" },
  { label: "Coach Feedback", value: "14", helper: "2 unread summaries" },
];

export const upcomingSessions = [
  {
    title: "Voice escalation simulation",
    time: "Today, 6:30 PM",
    host: "AI Coach + Team Lead",
  },
  {
    title: "Knowledge checkpoint review",
    time: "May 8, 2026",
    host: "Assessment Engine",
  },
];
