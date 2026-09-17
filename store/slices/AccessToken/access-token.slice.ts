import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AccessTokenResponse } from "./access-token.interface";

interface AccessTokenState {
  accessToken: string | null;
  expiresAt: string | null;
}

const initialState: AccessTokenState = {
  accessToken: null,
  expiresAt: null,
};

const accessTokenSlice = createSlice({
  name: "accessToken",
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<AccessTokenResponse>) => {
      state.accessToken = action.payload.accessToken;
      state.expiresAt = new Date(action.payload.expiresAt).toISOString();
    },
    clearAccessToken: (state) => {
      state.accessToken = null;
      state.expiresAt = null;
    },
  },
});

export const { setAccessToken, clearAccessToken } = accessTokenSlice.actions;
export default accessTokenSlice.reducer;
