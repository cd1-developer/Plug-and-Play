// Password/2FA fields are intentionally omitted — the app never collects them.
export interface GrowthStrategyPayload {
  growthStrategyId: string;
  loginLocation?: string;
  targetLocations?: string[];
  hashtags?: string[];
  targetAccounts?: string[];
  whiteList?: string[];
  blackList?: string[];
  maxFollowing?: number;
  targetMale?: boolean;
  targetFemale?: boolean;
  goals?: string;
  currentStatus?: string;
  historyEvaluation?: string;
  additionalInfo?: string;
  howDidYouHear?: string;
}

export interface GrowthStrategy extends GrowthStrategyPayload {
  id: string;
  clientAccountId: string;
  createdAt: string;
  updatedAt: string;
}
