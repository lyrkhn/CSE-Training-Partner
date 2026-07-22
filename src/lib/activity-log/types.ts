export type ActivityLogAction =
  | "course_created"
  | "course_updated"
  | "course_published"
  | "course_unpublished"
  | "course_deleted";

export type ActivityLogActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type ActivityLogEntry = {
  id: string;
  action: ActivityLogAction;
  actor: ActivityLogActor;
  target: {
    id: string;
    type: "roleplay_course";
    title: string;
  };
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
};
