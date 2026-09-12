export type AutomationStatus =
  | "IDLE"
  | "STARTING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "STOPPED"
  | "ACTION_REQUIRED"
  | "READY_TO_RUN"
  | "REVIEW_ACTIVITY"
  | "LOGIN_SUCCESSFULL";

/** Server-owned: is the device socket up, and when did we last hear from it. */
export interface DeviceConnection {
  online: boolean;
  lastSeen: number;
}

export interface LogEntry {
  message: string;
  timestamp: number;
}

/** Device-owned: full snapshot of the automation session. */
export interface AutomationState {
  sessionId?: string | null;
  status: AutomationStatus;
  automationType?: string | null;
  clientAccountId?: string | null;
  totalOperations: number;
  completedOperations: number;
  remainingOperations: number;
  currentTarget?: string | null;
  currentStep?: string | null;
  screen?: string;
  screenShotUrl?: string;
  // Operator-facing notice for screens that need a human action elsewhere
  // (e.g. TWM's "approve from your other device") rather than a click here.
  message?: string;
  error?: string | null;
  isMonitored?: boolean;
  updatedAt: number;
}

export interface ScrapeState {
  currentUsername?: string | null;
  totalScrape?: number;
  scrapeCount?: number;
  scrapeAccounts?: string[];
}

/** Two independent dimensions — a disconnect changes `connection`, never `automation`. */
export interface DeviceState {
  deviceId: string;
  connection?: DeviceConnection;
  automation?: AutomationState;
  scrape?: ScrapeState;
  logs?: LogEntry[];
}

/** Raw websocket message, discriminated by `type`. */
export interface DeviceMessage {
  type: string;
  deviceId: string;
  [key: string]: unknown;
}
