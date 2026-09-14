import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft } from "lucide-react";

import useDeviceMonitoring from "@/hooks/DeviceMonitoring/useDeviceMonitoring";
import useAction from "@/hooks/DeviceMonitoring/useAction";
import { useAppSelector } from "@/store/storeConfig";
import { successToast } from "@/components/Toasts";

interface AttemptLoginRemoteControlStepProps {
  deviceId: string;
  onFinish: () => void;
  /** Called once when HOME_SCREEN is reached (login succeeded) — e.g. to mark
   *  the client's daily status. Does NOT close the session; the grace timer
   *  below closes it (or the operator via Terminate). */
  onLoginSuccess?: () => void;
}

// After login (HOME_SCREEN), keep the stream open this long before closing
// automatically, so the operator can confirm/adjust. Terminate ends it sooner.
const GRACE_MS = 2 * 60 * 1000;

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const AttemptLoginRemoteControlStep = ({
  deviceId,
  onFinish,
  onLoginSuccess,
}: AttemptLoginRemoteControlStepProps) => {
  // The backend publishes screen=HOME_SCREEN when the login reaches the feed
  // (RunAutomation routes REMOTE_CONTROL through the login classifier). Unlike
  // the device's session status, this doesn't flip isRunning off, so the STOP
  // we send when the grace window ends still tears the session down.
  const screen = useAppSelector(
    (state) => state.devices[deviceId]?.automation?.screen,
  );

  const {
    status,
    dataChannelRef,
    proxyInputRef,
    videoRef,
    videoSize,
    setVideoSize,
    streamStats,
    remoteStream,
    deviceDimensions,
  } = useDeviceMonitoring({ deviceId });
  const {
    handleClick,
    handleLoadedMetadata,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    sendAction,
    handleTextInput,
  } = useAction({
    dataChannelRef,
    proxyInputRef,
    videoRef,
    videoSize,
    setVideoSize,
  });

  // Callbacks via refs so the countdown effect doesn't restart on every parent
  // re-render (onFinish/onLoginSuccess are usually fresh closures each render).
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onLoginSuccessRef = useRef(onLoginSuccess);
  onLoginSuccessRef.current = onLoginSuccess;

  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(GRACE_MS);

  // Only trust a HOME_SCREEN once THIS session's stream has actually come up —
  // otherwise a HOME_SCREEN left in the store from a previous session could
  // start the timer the moment this mounts.
  const sawLiveRef = useRef(false);
  useEffect(() => {
    if (remoteStream) sawLiveRef.current = true;
  }, [remoteStream]);

  // Home screen reached: record the login success now, then start the grace
  // window. Fires once per mount.
  const graceStartedRef = useRef(false);
  useEffect(() => {
    if (graceStartedRef.current || !sawLiveRef.current) return;
    if (screen !== "HOME_SCREEN") return;
    graceStartedRef.current = true;
    successToast("Login successful");
    onLoginSuccessRef.current?.();
    setGraceEndsAt(Date.now() + GRACE_MS);
  }, [screen, remoteStream]);

  // Tick the countdown; auto-terminate when it hits zero.
  useEffect(() => {
    if (graceEndsAt == null) return;
    let done = false;
    const tick = () => {
      const left = graceEndsAt - Date.now();
      setRemainingMs(left > 0 ? left : 0);
      if (left <= 0 && !done) {
        done = true;
        onFinishRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [graceEndsAt]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Device Monitor
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 border border-blue-100 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            {status}
          </div>
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.srcObject = null;
              onFinish();
            }}
            className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-100 active:scale-95 border border-red-100"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
            Terminate Session
          </button>
        </div>
      </div>

      {graceEndsAt != null && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 border border-emerald-100">
          Login successful — this session closes automatically in{" "}
          <span className="font-mono tabular-nums">
            {formatCountdown(remainingMs)}
          </span>
          . Use Terminate to close it now.
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-start justify-center gap-10 w-full">
        {/* Mobile Streaming View */}
        <div
          className="relative max-w-[360px] w-full bg-black rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-[10px] border-slate-900 select-none"
          style={{
            aspectRatio: deviceDimensions
              ? `${deviceDimensions.width} / ${deviceDimensions.height}`
              : videoSize
                ? `${videoSize.width} / ${videoSize.height}`
                : "9 / 16",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handleLoadedMetadata}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="w-full h-full object-contain cursor-crosshair pointer-events-auto"
          />
          {streamStats && (
            <div className="absolute top-3 left-3 rounded-lg bg-black/60 px-2.5 py-1.5 text-[10px] font-mono text-white/90 leading-snug pointer-events-none">
              <div>fps: {streamStats.renderFps.toFixed(1)}</div>
              <div>buffer: {streamStats.jitterBufferMs.toFixed(0)}ms</div>
              <div>dropped: {streamStats.framesDropped}</div>
              <div>freezes: {streamStats.freezeCount}</div>
            </div>
          )}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-slate-900/60 backdrop-blur-md">
              <div className="text-center p-6">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <p className="font-bold text-lg tracking-wide">
                  Synchronizing Stream...
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Establishing secure P2P connection
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Remote Control Panel (BESIDE) */}
        <div className="flex flex-col gap-8 w-full lg:max-w-[300px]">
          {/* Main Remote Body */}
          <div className="flex flex-col items-center gap-6 w-full p-8 bg-white rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100">
            <input
              ref={proxyInputRef}
              onChange={handleTextInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendAction("ENTER"); // reuse your existing sendAction() helper
              }}
              className="absolute opacity-0 pointer-events-none w-px h-px"
              autoComplete="off"
            />
            {/* Separator */}
            <div className="w-full h-px bg-slate-100" />

            {/* Back is the only navigation control exposed during onboarding. */}
            <button
              onClick={() => sendAction("BACK")}
              className="flex items-center justify-center p-5 bg-slate-50 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-full border border-slate-50 hover:border-indigo-100 hover:shadow-lg transition-all active:scale-90"
              title="Back"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
            </button>

            <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] text-center">
              System Control
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttemptLoginRemoteControlStep;
