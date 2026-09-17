# Plug & Play — Onboarding & Remote-Control Login Dashboard

> **Reading this as an AI coding agent?** Start with **[Mental model](#mental-model-read-this-first)**,
> then **[Invariants — do not break these](#invariants--do-not-break-these)**.
> Those two sections encode the non-obvious logic; everything else is detail.

The operator-facing frontend for the **Axon** Instagram-automation system. Its
job: onboard a client account onto a physical Android device, connect that
device to the right VPN location, and let a human operator **log the Instagram
account in by hand over a live remote-control (WebRTC) session** — the app never
types credentials or 2FA codes itself.

### The three repos (this is one of them)

| Repo                      | Role                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **plug_and_play** (this)  | Next.js operator dashboard. UI, WebRTC viewer + input, REST/WebSocket clients.                                                     |
| **Scaper_Backend**        | Node/Bun **WebSocket** server. Relays commands, classifies device screens, brokers WebRTC signaling, stores device state in Redis. |
| **Ig_Automation_Backned** | Hono + Prisma **REST** API. Growth strategies, client accounts, placements, daily status.                                          |
| **Axon**                  | Android app. Accessibility automation, screen-cast (WebRTC sender), executes taps, VPN control.                                    |

The dashboard never touches a device directly — everything goes through two
backends: the **WebSocket** server (live device state + WebRTC signaling +
automation commands) and the **REST** API (strategies, accounts, placements,
daily status). They are separate services.

---

## Mental model (read this first)

The whole UI is a **state machine driven by the client account's server-side
daily status**, not by local component state. The right-hand detail panel
(`app/feature/Onboarding/component/growth-strategy-detail-panel.tsx`) renders
one of a few states based on `dailyStatus.status`:

```
(submit growth strategy)                     ← THE REAL ENTRY POINT
        │  creates the client account WITHOUT a device (device-less) + the
        │  strategy, sets:
        ▼
   PENDING_LOGIN ──"Login your account"──► [connecting-vpn] ──device COMPLETED──► VPN_CONNECTED
        ▲               (VPN runs on a free                │                 ▲
        │                unassigned device                 │ device FAILED   │  on COMPLETED, BEFORE
        │                chosen for this session)           ▼                │  advancing: bind that
        └────────────────────────────────────── [vpn-failed] (Retry)        │  device to the account
                                                                             │  (PATCH assign-account)
   VPN_CONNECTED ──"Connect device"──► REMOTE CONTROL (WebRTC) ──────────────┘
        │  operator logs in live over the stream
        ▼
   screen == HOME_SCREEN reached
        │  → daily status set to LOGIN_SUCCESSFULL *immediately*
        │  → 2-minute grace countdown starts (session stays live)
        ▼
   session terminates: automatically at 0:00, OR operator hits "Terminate"
        │  → sends STOP → device closes Instagram + stops the cast
```

`connecting-vpn` / `vpn-failed` are **local, transient** sub-stages layered on
`PENDING_LOGIN`; they are not persisted. `LOGIN_SUCCESSFULL` is a server daily
status set over REST when the home screen is reached.

**Deferred device assignment (important):** submitting the strategy creates the
client account **with no device attached** — the backend's growth-strategy
create finds-or-creates the account by `igUsername`. A device is only bound
**after its VPN connects successfully**: on the device reporting `COMPLETED`,
`growth-strategy-detail-panel` calls `placementApi.assignClientAccount` (→ `PATCH
/placements/:id/assign-account`) to bind the chosen free placement to the
account, _then_ advances the daily status to `VPN_CONNECTED`. So if VPN never
succeeds, the account stays device-less and no placement is consumed. (This
replaced the old behavior where a device was picked and bound at submit via the
coupled create-and-assign call.)

### ⚠️ Testing-only shortcut — the biggest thing to understand

There is a **“get all growth strategies”** call (`GET /growth-strategy` via
`hooks/…/useGrowthStrategies`) that lists every strategy so a developer can
**pick any one and jump straight into its detail panel**.

**This is for testing/development only — it is NOT the production workflow.**
The real workflow _always_ begins with the operator **submitting a growth
strategy** (which creates the device-less account + strategy and sets
`PENDING_LOGIN`; the device is bound later, after VPN). Do not treat “select an
existing strategy from the list” as the entry point or build product logic
around it; it's scaffolding to exercise the later steps without re-onboarding
each time.

---

## Invariants — do not break these

These encode bugs already found and fixed. Changing them tends to reintroduce
the original bug.

1. **One shared WebSocket. Never open a second one in a component.**
   Use `useWebSocketContext()` (`hooks/websocket/WebsocketProvider.tsx`), mounted
   once at the root. A component that opens its own `useWebsocket()` will close
   that socket on unmount — and any message its unmount cleanup sends (notably
   the remote-control **`STOP`**) is then dropped on a closing socket, so the
   device never terminates. `useDeviceMonitoring` must read the shared socket.

2. **Start the WebRTC session once; tear down only on real unmount.**
   `useDeviceMonitoring` starts signaling the first time `connected` is true and
   returns its cleanup to run only when the component unmounts (Terminate / grace
   expiry). Do **not** make the start/stop effect depend on `connected` such that
   a socket reconnect re-runs it — a backgrounded-tab reconnect would then send
   `STOP` + `START` and relaunch the device (app reopens, then Instagram).

3. **`screen === "HOME_SCREEN"` is the login-success signal — not a device status.**
   The remote-control step keys the 2-minute grace + daily-status update off the
   `automation.screen` field (published by the backend). It deliberately does
   **not** use a device session status of `LOGIN_SUCCESSFULL`, because the device
   session must stay **running** through the grace window or the final `STOP`
   would be a no-op on the device (`stopIfRunning` bails when not running).

4. **The grace window keeps the session alive; only `STOP` ends it.**
   On home screen the device does _not_ self-terminate. Termination happens when
   the frontend sends `STOP` — at grace expiry (auto) or via the Terminate button
   (manual). `GRACE_MS` lives at the top of
   `app/feature/LoginAttempt/component/attempt-login-remote-control-step.tsx`.

5. **`onLoginSuccess` marks the daily status; it must NOT close the session.**
   Closing is the grace timer's / Terminate button's job. If `onLoginSuccess`
   also closes, the grace window collapses to zero.

6. **Never collect or send passwords / 2FA codes.**
   `GrowthStrategyPayload` intentionally omits them. The human types them on the
   device over the live stream; they never travel through this app.

7. **`loginAttempt: true` locks the device into Instagram.**
   The remote-control start command sets it so the device brings Instagram back
   if the operator leaves it mid-login. Plain monitoring leaves it false.

8. **A device is bound to the account only after VPN connects — never at submit.**
   Submit creates the account device-less; the bind (`placementApi
.assignClientAccount` → `PATCH /placements/:id/assign-account`) happens in the
   VPN-`COMPLETED` handler, _before_ advancing to `VPN_CONNECTED`. Do not move
   the assign back to submit — a failed VPN would otherwise strand a device
   permanently bound to an account that never logged in. Note the account is
   created by the **growth-strategy** create (finds-or-creates by `igUsername`),
   not by the old coupled `client-accounts/:placementId/assign` call.

---

## Message protocol (over the shared WebSocket)

All of these ride the one shared socket; `deviceId` scopes every message.

**Dashboard → device (commands & signaling):**

| Message              | When             | Shape (key fields)                                                                                      |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| Change VPN           | Step 2           | `{ status:"START", automationType:"Change Vpn Location", deviceId, vpnLocation }`                       |
| Start remote control | Step 3           | `{ status:"START", type:"OFFER", automationType:"Remote Control", deviceId, offer, loginAttempt:true }` |
| ICE                  | during signaling | `{ type:"ICE_CANDIDATE", deviceId, candidate:{ sdpMid, sdpMLineIndex, candidate } }`                    |
| Terminate            | Step 5           | `{ status:"STOP", automationType:"Remote Control", deviceId }`                                          |

**Key REST calls (over axios, separate from the socket):**

| Call                                    | When                 | Endpoint                                                            |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Create strategy (+ device-less account) | Submit               | `POST /growth-strategy/:username`                                   |
| Set daily status                        | Submit / VPN / login | `POST /daily-status/:clientAccountId`                               |
| **Bind device to account**              | **VPN success**      | `PATCH /placements/:placementId/assign-account { clientAccountId }` |

**Device → dashboard (via backend broadcast):**

| Message                | Meaning                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ANSWER`               | `{ type:"ANSWER", deviceId, sdp, screenWidth, screenHeight }` — completes signaling; screen size sets the video's aspect ratio.                              |
| `ICE_CANDIDATE`        | trickled ICE from the device.                                                                                                                                |
| `AUTOMATION_STATE`     | full per-device snapshot: `status`, `automationType`, `screen`, counts, etc. The backend patches `screen:"HOME_SCREEN"` onto this for remote-control logins. |
| `DEVICE_CONN`          | `{ online, lastSeen }` connection state.                                                                                                                     |
| `SCREEN_FRAME` / `LOG` | live screenshot bytes / device log lines.                                                                                                                    |

**Input** (taps, swipes, Back, Enter, text, scroll) does **not** use the
WebSocket — it goes over the **WebRTC data channel** (see `useAction`), as
normalized coordinates the device maps to real pixels.

---

## Access token — short-lived vs. long-lived

Two credentials, two lifetimes:

- **Long-lived**: `NEXT_PUBLIC_BACKEND_API_KEY`, a static secret from the env.
  It is used for exactly one thing — minting an access token — and is never
  attached to any other request.
- **Short-lived**: the actual bearer token used on every REST call and the
  WebSocket handshake. Minted by exchanging the long-lived key for one via
  `POST /access-token`
  (`app/feature/access-token/api/short-live-token.api.ts`), cached in Redux
  (`store/slices/AccessToken`) alongside its `expiresAt`, and persisted to
  `localStorage` (redux-persist whitelist) so a still-valid token survives a
  page reload instead of being re-minted.

`getAccessToken()` (`libs/AxiosInstance.ts`) is the single choke point both
consumers call through:

1. Cached token in Redux (backed by localStorage) and not yet past
   `expiresAt`? → return it, no network call.
2. Not found in Redux/localStorage, or past `expiresAt`? → if a (now-expired)
   token is still sitting in state, `clearAccessToken()` it first, then call
   `createAccessToken()` (spends the long-lived key), `setAccessToken()` the
   result into Redux, and return the new token as the REST
   `Authorization: Bearer` header. Concurrent callers share one in-flight mint
   via `pendingTokenRequest` so a burst of requests on mount doesn't mint
   several tokens at once.

Expiry is handled by removal, not a stale flag: once a token is past
`expiresAt` it's cleared from Redux rather than left in place, so step 1 above
naturally falls through to step 2 next time anyone asks for a token — there is
no separate "is it expired" branch elsewhere in the app to keep in sync.

Consumers:

- **REST** — `axiosInstance`'s request interceptor calls `getAccessToken()`
  and sets `Authorization: Bearer <token>` on every outgoing request.
- **WebSocket** — `hooks/websocket/useWebsocket.tsx` awaits the same
  `getAccessToken()` and appends the token as a `?token=` query param before
  connecting, since the native `WebSocket` API can't set custom headers.

**Invariant:** `createAccessToken()` must call a bare `axios.post(...)`, never
the shared `axiosInstance`. `axiosInstance`'s interceptor calls
`createAccessToken()` to mint a token — routing the mint call back through
`axiosInstance` makes the interceptor await its own in-flight
`pendingTokenRequest`, which deadlocks every request in the app the first
time a token needs minting.

---

## Where the logic lives (file map)

```
app/
  page.tsx                                  Entry → renders <OnboardingFlow>
  layout.tsx                                Providers: Redux → ReactQuery → WebSocket → Peer
  api/vpn-locations/closest/route.ts        Next route handler: closest VPN location lookup

  feature/Onboarding/component/
    onboarding-flow.tsx                     Strategy list (left) + detail panel (right); create-new wizard
    growth-strategy-detail-panel.tsx        STATE MACHINE: renders per daily status; VPN + remote-control launch

  feature/LoginAttempt/component/
    attempt-login-remote-control-step.tsx   WebRTC viewer + control panel + 2-min grace countdown (GRACE_MS here)
    attempt-login-browse-dialog.tsx         Alt entry: random unassigned device → VPN → remote control
    attempt-login-location-step.tsx         VPN location picker
    live-device-screenshot.tsx              SCREEN_FRAME viewer (used during VPN connect)

  feature/growth-strategy/                  api (create[also creates the account] / getAll[testing] / get), hooks, form, list, types
  feature/client-account/                   api.assign (legacy create-and-assign in one shot — NOT used by the current flow)
  feature/daily-status/                     api.upsert / getLatest; DailyActivityStatus type
  feature/placemenet/                       api.assignClientAccount (bind device after VPN), useUnassignedPlacements, usePlacementForClientAccount, device-status utils
  feature/access-token/api/                 short-live-token.api.ts: mints short-lived token via long-lived x-api-key

hooks/
  websocket/WebsocketProvider.tsx           THE shared socket + useWebSocketContext()
  websocket/useWebsocket.tsx                socket impl (reconnect, listener set, Redux dispatch) — used only by the provider
  Peer/PeerProvider.tsx, usePeer.tsx        shared RTCPeerConnection: createOffer / setRemoteAns / resetPeer / remoteStream
  DeviceMonitoring/useDeviceMonitoring.tsx  WebRTC session lifecycle, signaling, stats, STOP-on-unmount
  DeviceMonitoring/useAction.tsx            translates operator input → data-channel messages

store/slices/devices/
  devices.slice.ts                          reducers: deviceMessage (routes by type), patchAutomation (optimistic)
  devices.interface.ts                      AutomationState / DeviceState / status unions

store/slices/AccessToken/
  access-token.slice.ts                     caches the short-lived token + expiresAt, persisted to localStorage
  access-token.interface.ts                 AccessTokenResponse shape

libs/AxiosInstance.ts                       axios: baseURL = NEXT_PUBLIC_BACKEND_URL + "/api"; getAccessToken() + Authorization: Bearer interceptor (see Access token section)
utils/service/LocationService.ts            closest-VPN-location resolution
components/                                 shadcn/radix UI, Toasts (sonner), ErrorBoundary
```

---

## State management

- **Redux** (`store/slices/devices`) is the live mirror of every device, fed by
  WebSocket messages. `deviceMessage` routes by `msg.type`; `AUTOMATION_STATE`
  **replaces** `device.automation` wholesale (full snapshot, last-write-wins) —
  so the incoming blob must carry every field you rely on (including `screen`).
  `patchAutomation` is an optimistic local patch used before the device's own
  snapshot lands (e.g. flip to `STARTING` on start).
- **React Query** handles REST reads/writes (growth strategies, daily status,
  placements) with caching + `refetch`.
- **PeerProvider** owns the single `RTCPeerConnection`; `remoteStream` is what
  the `<video>` renders.

---

## Environment variables

Create `.env.local` (gitignored):

| Variable                            | Purpose                                            |
| ----------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_WEBSOCKET_URL`         | WebSocket server URL (e.g. `ws://localhost:8080`). |
| `NEXT_PUBLIC_BACKEND_URL`           | REST API base (axios appends `/api`).              |
| `NEXT_PUBLIC_BACKEND_API_KEY`       | Long-lived secret, spent only to mint the short-lived access token (see [Access token](#access-token--short-lived-vs-long-lived)). |
| `NEXT_PUBLIC_LOCATION_API_ENDPOINT` | VPN/location lookup endpoint.                      |

Nothing is hardcoded — all config comes from the environment. `NEXT_PUBLIC_*` is
browser-exposed by design; keep true secrets out of it.

---

## Getting started

```bash
bun install            # or: npm install   (a bun.lock is committed)
# create .env.local with the values above
bun run dev            # or: npm run dev  →  http://localhost:3000
```

Scripts: `dev`, `build`, `start`, `lint`.

**For a full run** the WebSocket server and REST API must both be up. Submitting
a growth strategy needs neither a device nor the WebSocket (it's REST-only), but
the **Connect VPN** step onward needs at least one Android device online (a free
_placement_) — that's where a device is chosen, VPN-connected, and then bound to
the account.

---

## Troubleshooting quick-reference

| Symptom                                                       | Likely cause                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote video is blank                                         | When an Android device is connected to a VPN, the frontend may previously have displayed a blank screen due to connectivity issues. This issue has been resolved, and users can now view the device screen even while the VPN is connected. Currently, STUN is sufficient to establish the required connection, so TURN server configuration is not required. |
| Terminate hides the UI but the device keeps running           | A `STOP` was sent on a closing/second socket — see invariant #1.                                                                                                                                                                                                                                                                                              |
| Device relaunches (app then Instagram) repeatedly             | Start/stop effect re-firing on socket reconnect — see invariant #2.                                                                                                                                                                                                                                                                                           |
| Session closes instantly on login instead of granting 2 min   | `onLoginSuccess` closing the session, or reading a device `LOGIN_SUCCESSFULL` status instead of `screen==="HOME_SCREEN"` — invariants #3 & #5.                                                                                                                                                                                                                |
| "Failed to assign device to account" toast after VPN connects | The `PATCH /placements/:id/assign-account` bind failed — check the REST base URL / `x-api-key`, that the placement is still free, and that the backend has this route (see invariant #8).                                                                                                                                                                     |

---

## Tech stack

Next.js 16 (App Router) · React 19 · Redux Toolkit + redux-persist · TanStack
Query · WebRTC · Tailwind CSS 4 · shadcn/radix UI · sonner · axios.
