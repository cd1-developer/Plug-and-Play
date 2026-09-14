import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Placement } from "@/app/feature/placemenet/types/placemenet.interface";

interface PlacementsState {
  /** `null` = not fetched yet (fetch it); `[]` = fetched, none exist. */
  unassigned: Placement[] | null;
  /** Keyed by clientAccountId — fetched one at a time via the targeted
   *  by-client-account endpoint, not by fetching every placement and
   *  filtering. Key absent = not fetched yet; `null` value = fetched, no
   *  placement linked to that account. */
  byClientAccountId: Record<string, Placement | null>;
}

const initialState: PlacementsState = {
  unassigned: null,
  byClientAccountId: {},
};

const placementsSlice = createSlice({
  name: "placements",
  initialState,
  reducers: {
    setUnassignedPlacements: (state, action: PayloadAction<Placement[]>) => {
      state.unassigned = action.payload;
    },
    setPlacementForClientAccount: (
      state,
      action: PayloadAction<{ clientAccountId: string; placement: Placement | null }>,
    ) => {
      state.byClientAccountId[action.payload.clientAccountId] = action.payload.placement;
    },
    clearPlacements: () => initialState,
  },
});

export const {
  setUnassignedPlacements,
  setPlacementForClientAccount,
  clearPlacements,
} = placementsSlice.actions;
export default placementsSlice.reducer;
