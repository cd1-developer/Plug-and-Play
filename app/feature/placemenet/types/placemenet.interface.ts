export interface Placement {
  id: string;
  placementName: string;
  deviceId: string | null;

  clientAccountId: string | null;

  createdAt: Date;
}
