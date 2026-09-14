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

| Repo | Role |
| --- | --- |
| **plug_and_play** (this) | Next.js operator dashboard. UI, WebRTC viewer + input, REST/WebSocket clients. |
| **Scaper_Backend** | Node/Bun WebSocket + REST server. Relays commands, classifies device screens, brokers WebRTC signaling, stores device state in Redis. |
| **Axon** | Android app. Accessibility automation, screen-cast (WebRTC sender), executes taps, VPN control. |

The dashboard never touches a device directly — everything goes through
`Scaper_Backend` over one WebSocket (live state + signaling + commands) and a
REST API (strategies, accounts, placements, daily status).

---

## Mental model (read this first)

The whole UI is a **state machine driven by the client account's server-side
daily status**, not by local component state. The right-hand detail panel
(`app/feature/Onboarding/component/growth-strategy-detail-panel.tsx`) renders
one of a few states based on `dailyStatus.status`:

```
(submit growth strategy)                     ← THE REAL ENTRY POINT
        │  creates client account, assigns a device, sets:
        ▼
   PENDING_LOGIN ──"Login your account"──► [connecting-vpn] ──device COMPLETED──► VPN_CONNECTED
        ▲                                        │ device FAILED
        └────────────────────────────────────── [vpn-failed] (Retry)
                                                                                     │
   VPN_CONNECTED ──"Connect device"──► REMOTE CONTROL (WebRTC) ─────────────────────┘
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

### ⚠️ Testing-only shortcut — the biggest thing to understand

There is a **“get all growth strategies”** call (`GET /growth-strategy` via
`hooks/…/useGrowthStrategies`) that lists every strategy so a developer can
**pick any one and jump straight into its detail panel**.

**This is for testing/development only — it is NOT the production workflow.**
The real workflow *always* begins with the operator **submitting a growth
strategy** (which creates the account, assigns a device, and sets
`PENDING_LOGIN`). Do not treat “select an existing strategy from the list” as
the entry point or build product logic around it; it's scaffolding to exercise
the later steps without re-onboarding each time.

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
   On home screen the device does *not* self-terminate. Termination happens when
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

---

## Message protocol (over the shared WebSocket)

All of these ride the one shared socket; `deviceId` scopes every message.

**Dashboard → device (commands & signaling):**

| Message | When | Shape (key fields) |
| --- | --- | --- |
| Change VPN | Step 2 | `{ status:"START", automationType:"Change Vpn Location", deviceId, vpnLocation }` |
| Start remote control | Step 3 | `{ status:"START", type:"OFFER", automationType:"Remote Control", deviceId, offer, loginAttempt:true }` |
| ICE | during signaling | `{ type:"ICE_CANDIDATE", deviceId, candidate:{ sdpMid, sdpMLineIndex, candidate } }` |
| Terminate | Step 5 | `{ status:"STOP", automationType:"Remote Control", deviceId }` |

**Device → dashboard (via backend broadcast):**

| Message | Meaning |
| --- | --- |
| `ANSWER` | `{ type:"ANSWER", deviceId, sdp, screenWidth, screenHeight }` — completes signaling; screen size sets the video's aspect ratio. |
| `ICE_CANDIDATE` | trickled ICE from the device. |
| `AUTOMATION_STATE` | full per-device snapshot: `status`, `automationType`, `screen`, counts, etc. The backend patches `screen:"HOME_SCREEN"` onto this for remote-control logins. |
| `DEVICE_CONN` | `{ online, lastSeen }` connection state. |
| `SCREEN_FRAME` / `LOG` | live screenshot bytes / device log lines. |

**Input** (taps, swipes, Back, Enter, text, scroll) does **not** use the
WebSocket — it goes over the **WebRTC data channel** (see `useAction`), as
normalized coordinates the device maps to real pixels.

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

  feature/growth-strategy/                  api (create / getAll[testing] / get), hooks, form, list, types
  feature/client-account/                   api.assign(placementId, igUsername)
  feature/daily-status/                     api.upsert / getLatest; DailyActivityStatus type
  feature/placemenet/                       useUnassignedPlacements, usePlacementForClientAccount, device-status utils

hooks/
  websocket/WebsocketProvider.tsx           THE shared socket + useWebSocketContext()
  websocket/useWebsocket.tsx                socket impl (reconnect, listener set, Redux dispatch) — used only by the provider
  Peer/PeerProvider.tsx, usePeer.tsx        shared RTCPeerConnection: createOffer / setRemoteAns / resetPeer / remoteStream
  DeviceMonitoring/useDeviceMonitoring.tsx  WebRTC session lifecycle, signaling, stats, STOP-on-unmount
  DeviceMonitoring/useAction.tsx            translates operator input → data-channel messages

store/slices/devices/
  devices.slice.ts                          reducers: deviceMessage (routes by type), patchAutomation (optimistic)
  devices.interface.ts                      AutomationState / DeviceState / status unions

libs/AxiosInstance.ts                       axios: baseURL = NEXT_PUBLIC_BACKEND_URL + "/api", x-api-key header
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

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_WEBSOCKET_URL` | WebSocket server URL (e.g. `ws://localhost:8080`). |
| `NEXT_PUBLIC_BACKEND_URL` | REST API base (axios appends `/api`). |
| `NEXT_PUBLIC_BACKEND_API_KEY` | Sent as `x-api-key` on REST requests. |
| `NEXT_PUBLIC_LOCATION_API_ENDPOINT` | VPN/location lookup endpoint. |

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

**For a full run** the WebSocket server and REST API must be up, and at least one
Android device must be online (a *placement*) so the onboarding flow has a device
to work with. Without a device, you can still load the UI but can't complete the
VPN/remote-control steps.

---

## Troubleshooting quick-reference

| Symptom | Likely cause |
| --- | --- |
| Remote video is blank | ICE never connected — often a VPN blocking the direct path; needs a TURN relay (STUN alone isn't enough). Check `ICE connection state` logs on the device. |
| Terminate hides the UI but the device keeps running | A `STOP` was sent on a closing/second socket — see invariant #1. |
| Device relaunches (app then Instagram) repeatedly | Start/stop effect re-firing on socket reconnect — see invariant #2. |
| Session closes instantly on login instead of granting 2 min | `onLoginSuccess` closing the session, or reading a device `LOGIN_SUCCESSFULL` status instead of `screen==="HOME_SCREEN"` — invariants #3 & #5. |

---

## Tech stack

Next.js 16 (App Router) · React 19 · Redux Toolkit + redux-persist · TanStack
Query · WebRTC · Tailwind CSS 4 · shadcn/radix UI · sonner · axios.
