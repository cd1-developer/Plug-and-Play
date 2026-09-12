import React, { useRef, useState, useEffect, useCallback } from "react";

import useWebsocket from "@/hooks/websocket/useWebsocket";
import { usePeer } from "@/hooks/Peer/usePeer";

function useDeviceMonitoring({ deviceId }: { deviceId: string }) {
  const { connected, socket, addListener, removeListener } = useWebsocket();

  const { peer, remoteStream, createOffer, setRemoteAns, resetPeer } =
    usePeer();

  // Read via ref inside startMonitoring so a socket reconnect (its identity
  // changing) doesn't retrigger the effect and restart the whole WebRTC
  // negotiation — it would otherwise send a second OFFER on a fresh
  // RTCPeerConnection while the first one's exchange is still in flight.
  const socketRef = useRef<WebSocket | null>(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const proxyInputRef = useRef<HTMLInputElement>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [status, setStatus] = useState("Initializing...");

  const [deviceDimensions, setDeviceDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [videoSize, setVideoSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [streamStats, setStreamStats] = useState<{
    renderFps: number;
    jitterBufferMs: number;
    framesDropped: number;
    freezeCount: number;
  } | null>(null);

  /**
   * Setup WebRTC DataChannel
   */
  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dc.onopen = () => {
      console.log("DataChannel Open");
    };

    dc.onclose = () => {
      console.log("DataChannel Closed");
    };
  }, []);

  /**
   * Attach remote stream to video element
   */
  const handleRemoteStream = useCallback(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    handleRemoteStream();
  }, [handleRemoteStream]);

  /**
   * Poll WebRTC statistics
   */
  const monitorStreamStats = useCallback(() => {
    if (!peer) return;

    let prevFramesDecoded: number | null = null;
    let prevTimestamp: number | null = null;

    const interval = setInterval(async () => {
      const report = await peer.getStats();

      report.forEach((stat) => {
        if (stat.type === "inbound-rtp" && stat.kind === "video") {
          const jitterBufferMs =
            stat.jitterBufferEmittedCount > 0
              ? (stat.jitterBufferDelay / stat.jitterBufferEmittedCount) * 1000
              : 0;

          let renderFps = 0;

          if (prevFramesDecoded != null && prevTimestamp != null) {
            const elapsedSec = (stat.timestamp - prevTimestamp) / 1000;

            if (elapsedSec > 0) {
              renderFps = (stat.framesDecoded - prevFramesDecoded) / elapsedSec;
            }
          }

          prevFramesDecoded = stat.framesDecoded;
          prevTimestamp = stat.timestamp;

          console.log(
            `STATS[recv] renderFps=${renderFps.toFixed(
              1,
            )} jitterBufferMs=${jitterBufferMs.toFixed(0)} ` +
              `framesDropped=${stat.framesDropped} ` +
              `freezeCount=${stat.freezeCount} ` +
              `totalFreezesDuration=${stat.totalFreezesDuration?.toFixed(2)}`,
          );

          setStreamStats({
            renderFps,
            jitterBufferMs,
            framesDropped: stat.framesDropped ?? 0,
            freezeCount: stat.freezeCount ?? 0,
          });
        }
      });
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [peer]);

  useEffect(() => {
    const cleanup = monitorStreamStats();

    return cleanup;
  }, [monitorStreamStats]);

  /**
   * Start WebRTC signaling/session
   */
  const startMonitoring = useCallback(() => {
    const connection = resetPeer();

    const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.send(
          JSON.stringify({
            type: "ICE_CANDIDATE",
            deviceId,
            candidate: {
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              candidate: event.candidate.candidate,
            },
          }),
        );
      }
    };

    const handleDataChannel = (event: RTCDataChannelEvent) => {
      dataChannelRef.current = event.channel;
      setupDataChannel(event.channel);
    };

    connection.addEventListener("icecandidate", handleIceCandidate);

    connection.addEventListener("datachannel", handleDataChannel);

    const dc = connection.createDataChannel("remote-control");

    dataChannelRef.current = dc;

    setupDataChannel(dc);

    // ICE candidates can arrive before the ANSWER does — addIceCandidate
    // throws until the remote description is set, so queue them until then.
    let remoteDescSet = false;
    let pendingCandidates: RTCIceCandidateInit[] = [];

    // A second ANSWER can arrive while the first is still being applied
    // (setRemoteDescription is async, so connection.signalingState doesn't
    // flip to "stable" until it resolves — checking it isn't enough to stop
    // a concurrent second call). This flag commits synchronously, before
    // any await, so only the first ANSWER is ever applied.
    let answerHandled = false;

    const messageListener = async (msg: any) => {
      if (msg.deviceId !== deviceId) return;

      if (msg.type === "ANSWER") {
        if (answerHandled) return;
        answerHandled = true;

        if (msg.screenWidth && msg.screenHeight) {
          setDeviceDimensions({
            width: msg.screenWidth,
            height: msg.screenHeight,
          });
        }

        await setRemoteAns({
          type: "answer",
          sdp: msg.sdp,
        });

        remoteDescSet = true;
        for (const candidate of pendingCandidates) {
          await connection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates = [];

        setStatus("Connected");
      } else if (msg.type === "ICE_CANDIDATE") {
        if (msg.candidate) {
          if (remoteDescSet) {
            await connection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else {
            pendingCandidates.push(msg.candidate);
          }
        }
      }
    };

    addListener(messageListener);

    const startSignaling = async () => {
      try {
        setStatus("Creating offer...");

        connection.addTransceiver("video", {
          direction: "recvonly",
        });

        const offer = await createOffer();

        socketRef.current?.send(
          JSON.stringify({
            status: "START",
            type: "OFFER",
            automationType: "Remote Control",
            clientAccountId: "remote-web",
            planF: 0,
            planUf: 0,
            deviceId,
            offer: offer.sdp,
            // This stream exists to log Instagram in by hand: the device
            // locks itself into Instagram and ends the session with
            // LOGIN_SUCCESSFULL once the backend classifies HOME_SCREEN.
            loginAttempt: true,
          }),
        );

        setStatus("Waiting for answer...");
      } catch (err) {
        console.error("Failed to start signaling", err);

        setStatus("Error: " + (err as Error).message);
      }
    };

    startSignaling();

    return () => {
      connection.removeEventListener("icecandidate", handleIceCandidate);

      connection.removeEventListener("datachannel", handleDataChannel);

      removeListener(messageListener);

      socketRef.current?.send(
        JSON.stringify({
          status: "STOP",
          automationType: "Remote Control",
          deviceId,
        }),
      );
    };
  }, [
    deviceId,
    resetPeer,
    setupDataChannel,
    createOffer,
    setRemoteAns,
    addListener,
    removeListener,
  ]);

  // Start the WebRTC session ONCE — the first time the signaling socket is
  // open — and tear it down only on real unmount (Terminate button / dialog
  // close). A backgrounded browser tab gets throttled, so switching windows
  // drops the socket and reconnects, flipping `connected` false→true. But the
  // established peer connection and the device's screen cast both survive a
  // signaling blip (signaling is only needed for the initial handshake, and
  // ICE/ANSWER still flow over the reconnected socket via the stable listener
  // set). Re-running startMonitoring on every reconnect would send STOP then
  // START to the device — STOP returns our app to the foreground, START
  // re-requests projection and reopens Instagram: the "my app opens, then
  // Instagram" relaunch. Decoupling start/stop from `connected` stops that.
  // ponytail: a socket death inside the ~1s handshake window before the
  // session establishes won't auto-retry now; add an ICE-restart path if that
  // proves flaky in practice.
  const cleanupRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!connected || startedRef.current) return;
    startedRef.current = true;
    cleanupRef.current = startMonitoring();
  }, [connected, startMonitoring]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      startedRef.current = false;
    };
  }, []);

  return {
    status,
    dataChannelRef,
    proxyInputRef,
    videoRef,
    videoSize,
    setVideoSize,
    streamStats,
    remoteStream,
    deviceDimensions,
  };
}

export default useDeviceMonitoring;
