export type DailyActivityStatus =
  | "WORKING"
  | "SOFT_ACTION_BLOCK"
  | "ACTION_BLOCK"
  | "SUSPENDED"
  | "CHALLENGE_REQUIRED"
  | "LOGGED_OUT"
  | "PAUSE_ACTIVITY"
  | "PENDING_LOGIN"
  | "LOGIN_SUCCESSFULL"
  | "VPN_CONNECTED";

export interface DailyStatus {
  id: string;
  clientAccountId: string;
  date: string;
  status: DailyActivityStatus;
  createdAt?: string;
  updatedAt?: string;
}
