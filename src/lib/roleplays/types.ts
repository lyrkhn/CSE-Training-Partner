import type { Objective } from "@/src/lib/objectives/types";

export type RolePlayStatus = "draft" | "published";

export type RolePlayConfig = {
  id: string;
  status: RolePlayStatus;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  plan: {
    scenario: string;
    learnerRole: string;
  };
  character: {
    presetId?: string;
    name: string;
    role: string;
    voiceId?: string;
    personalityBackground: string;
    greetingMessage: string;
  };
  settings: {
    meetingTitle: string;
    durationMinutes: number;
    learnerGoals: Objective[];
    aiCustomerKeyPoints?: string[];
    originalCallSummary?: string;
    aiCustomerBehavior?: string;
    deadlineAt?: string;
    deadlineTimezone?: string;
    attemptOverrides?: Record<
      string,
      {
        maxAttempts: number;
        note?: string;
        updatedAt?: string;
        updatedBy?: {
          id: string;
          name: string;
          email: string;
          role: string;
        };
      }
    >;
    evaluatorPrompt: string;
    assignedTraineeIds?: string[];
  };
  generated: {
    system_message: string;
    greeting_message: string;
    greeting_message_switch: "single_first";
    delay_ms: 1200;
  };
};

export type RolePlayGeneratedConfig = RolePlayConfig["generated"];
