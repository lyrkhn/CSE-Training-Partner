import type { Objective } from "@/src/lib/objectives/types";

export type RolePlayStatus = "draft" | "published";

export type RolePlayConfig = {
  id: string;
  status: RolePlayStatus;
  plan: {
    scenario: string;
    learnerRole: string;
  };
  character: {
    name: string;
    role: string;
    personalityBackground: string;
    greetingMessage: string;
  };
  settings: {
    meetingTitle: string;
    durationMinutes: number;
    learnerGoals: Objective[];
    evaluatorPrompt: string;
  };
  generated: {
    system_message: string;
    greeting_message: string;
    greeting_message_switch: "single_first";
    delay_ms: 800;
  };
};

export type RolePlayGeneratedConfig = RolePlayConfig["generated"];
