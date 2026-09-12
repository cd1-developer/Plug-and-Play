"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

interface PeerContextType {
  peer: RTCPeerConnection | null;
  remoteStream: MediaStream | null;
  resetPeer: () => RTCPeerConnection; // NEW
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswer: (
    offer: RTCSessionDescription,
  ) => Promise<RTCSessionDescriptionInit>;
  setRemoteAns: (ans: RTCSessionDescriptionInit) => Promise<void>;
}
export const PeerContext = React.createContext<PeerContextType | null>(null);

export const PeerProvider = ({ children }: { children: React.ReactNode }) => {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [peer, setPeer] = useState<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const getPeer = () => {
    if (!peerRef.current) {
      peerRef.current = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:global.stun.twilio.com:3478",
            ],
          },
        ],
      });
    }

    return peerRef.current;
  };
  const handleTrack = useCallback((event: RTCTrackEvent) => {
    console.log("🎥 Received remote track:", event.track.kind, event.streams);
    const [incomingStream] = event.streams;
    setRemoteStream(incomingStream ?? null);

    // Chrome grows the receive jitter buffer to smooth out arrival jitter,
    // but rarely shrinks it back down aggressively — once the buffer target
    // grows (e.g. from a burst caused by the sender-side backlog) playback
    // stays that far behind "live" for the rest of the session. These are
    // non-standard Chrome-only hints that bias the buffer toward the lowest
    // latency it can sustain instead of the smoothest playback; both are
    // no-ops (not thrown) on browsers that don't support them.
    const receiver = event.receiver as RTCRtpReceiver & {
      playoutDelayHint?: number;
      jitterBufferTarget?: number;
    };
    try {
      receiver.playoutDelayHint = 0;
      receiver.jitterBufferTarget = 0;
    } catch {
      /* not supported on this browser; falls back to default buffering */
    }

    event.track.addEventListener("ended", () => {
      setRemoteStream((prev) => {
        if (!prev) return prev;
        const stillLive = prev
          .getTracks()
          .some((track) => track.readyState === "live");
        return stillLive ? prev : null;
      });
    });
  }, []);

  useEffect(() => {
    const connection = getPeer();

    connection.addEventListener("track", handleTrack);
    setPeer(connection);

    return () => {
      connection.removeEventListener("track", handleTrack);
      connection.close();
      peerRef.current = null;
    };
  }, []);

  const createOffer = useCallback(async () => {
    const connection = getPeer();

    const offer = await connection.createOffer();

    await connection.setLocalDescription(offer);

    return offer;
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    try {
      const connection = getPeer();

      await connection.setRemoteDescription(offer);

      const answer = await connection.createAnswer();

      await connection.setLocalDescription(answer);

      return answer;
    } catch (error) {
      console.error("❌ Error creating answer:", error);

      throw error;
    }
  }, []);

  const setRemoteAns = useCallback(async (ans: RTCSessionDescriptionInit) => {
    await getPeer().setRemoteDescription(ans);
  }, []);

  const resetPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.removeEventListener("track", handleTrack);
      peerRef.current.close(); // kill old SDP/ICE/transceiver state
      peerRef.current = null;
    }
    const connection = getPeer(); // builds a brand new RTCPeerConnection
    connection.addEventListener("track", handleTrack);
    setPeer(connection);
    setRemoteStream(null);
    return connection;
  }, [handleTrack]);

  return (
    <PeerContext.Provider
      value={{
        peer,
        remoteStream,
        createOffer,
        createAnswer,
        setRemoteAns,
        resetPeer,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
