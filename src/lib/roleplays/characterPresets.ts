export type RolePlayCharacterPreset = {
  id: string;
  name: string;
  gender: "male" | "female";
  voiceId: string;
  personaLabel: string;
};

export const rolePlayCharacterPresets = [
  {
    id: "michael",
    name: "Michael",
    gender: "male",
    voiceId: "English_expressive_narrator",
    personaLabel: "Expressive male narrator",
  },
  {
    id: "chris",
    name: "Chris",
    gender: "male",
    voiceId: "English_Persuasive_Man",
    personaLabel: "Persuasive male speaker",
  },
  {
    id: "loria",
    name: "Loria",
    gender: "female",
    voiceId: "English_MatureBoss",
    personaLabel: "Mature female leader",
  },
  {
    id: "serena",
    name: "Serena",
    gender: "female",
    voiceId: "English_intellect_female_1",
    personaLabel: "Intellectual female speaker",
  },
] as const satisfies readonly RolePlayCharacterPreset[];

export const defaultRolePlayCharacterPreset = rolePlayCharacterPresets[0];

export function getRolePlayCharacterPreset(presetId: string | undefined) {
  return rolePlayCharacterPresets.find((preset) => preset.id === presetId);
}

export function getRolePlayCharacterPresetByVoiceId(voiceId: string | undefined) {
  return rolePlayCharacterPresets.find((preset) => preset.voiceId === voiceId);
}
