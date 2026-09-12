export const AUTOMATION_TYPES = [
  "Operation",
  "Check Client Location",
  "Change Vpn Location",
  "Check Login Location",
  "Check True Growth",
  "Remote Control",
  "Attempt Login",
] as const;

export type AutomationType = (typeof AUTOMATION_TYPES)[number];
