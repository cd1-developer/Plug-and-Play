"use client";

import { useLiveScreenFrame } from "../hooks/useLiveScreenFrame";

interface LiveDeviceScreenshotProps {
  deviceId: string | null;
}

/** Shows the device's screen live while Attempt Login runs, fed by SCREEN_FRAME
 *  messages pushed directly over the control WebSocket — plain JPEG frames,
 *  no upload/URL round trip and no WebRTC. The device stops sending frames on
 *  its own once HOME_SCREEN is reached, so this just renders whatever the
 *  latest frame is and disappears when none has arrived yet. */
function LiveDeviceScreenshot({ deviceId }: LiveDeviceScreenshotProps) {
  const frame = useLiveScreenFrame(deviceId);

  if (!frame) return null;

  return (
    <div className="w-72 shrink-0 overflow-hidden rounded-lg border bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/jpeg;base64,${frame}`}
        alt="Live device screen"
        className="w-full object-contain"
      />
    </div>
  );
}

export default LiveDeviceScreenshot;
