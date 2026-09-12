import { useCallback, useRef, useState } from "react";

type UseActionProps = {
  dataChannelRef: React.MutableRefObject<RTCDataChannel | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  proxyInputRef: React.RefObject<HTMLInputElement | null>;
  videoSize: {
    width: number;
    height: number;
  } | null;
  setVideoSize: React.Dispatch<
    React.SetStateAction<{
      width: number;
      height: number;
    } | null>
  >;
};

function useAction({
  dataChannelRef,
  videoRef,
  proxyInputRef,
  videoSize,
  setVideoSize,
}: UseActionProps) {
  const [isScrolling, setIsScrolling] = useState(false);

  const scrollStartRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  /**
   * Check whether DataChannel is ready
   */
  const isDataChannelOpen = useCallback(() => {
    return dataChannelRef.current?.readyState === "open";
  }, [dataChannelRef]);

  /**
   * Get the actual visible video content rect.
   *
   * This handles object-contain letterboxing/pillarboxing.
   */
  const getContentRect = useCallback(() => {
    const video = videoRef.current;

    if (!video || !videoSize) {
      return null;
    }

    const elRect = video.getBoundingClientRect();

    const elementAspect = elRect.width / elRect.height;

    const videoAspect = videoSize.width / videoSize.height;

    let width = elRect.width;
    let height = elRect.height;

    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > elementAspect) {
      // Letterboxed: bars on top/bottom
      height = elRect.width / videoAspect;
      offsetY = (elRect.height - height) / 2;
    } else {
      // Pillarboxed: bars on left/right
      width = elRect.height * videoAspect;
      offsetX = (elRect.width - width) / 2;
    }

    return {
      left: elRect.left + offsetX,
      top: elRect.top + offsetY,
      width,
      height,
    };
  }, [videoRef, videoSize]);

  /**
   * Mouse move
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      if (!isDataChannelOpen()) {
        return;
      }

      // We don't usually want to send every mouse move
      // to avoid flooding the DataChannel.
    },
    [isDataChannelOpen],
  );

  /**
   * Video metadata loaded
   */
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    // This should ideally be controlled by the parent
    // if videoSize is owned outside this hook.
    setVideoSize({ width: video.videoWidth, height: video.videoHeight });
  }, [videoRef]);

  /**
   * Click action
   */
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      if (!isDataChannelOpen() || !videoRef.current) {
        return;
      }

      const contentRect = getContentRect();

      if (!contentRect) {
        return;
      }

      const relativeX = e.clientX - contentRect.left;

      const relativeY = e.clientY - contentRect.top;

      // Ignore clicks inside letterbox/pillarbox area.
      if (
        relativeX < 0 ||
        relativeX > contentRect.width ||
        relativeY < 0 ||
        relativeY > contentRect.height
      ) {
        return;
      }

      const x = (relativeX / contentRect.width) * 1000;

      const y = (relativeY / contentRect.height) * 1000;

      console.log(`🎯 Precise Click: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);

      dataChannelRef.current!.send(
        JSON.stringify({
          type: "CLICK",
          x,
          y,
        }),
      );

      /**
       * Focus local proxy input.
       */
      if (proxyInputRef.current) {
        proxyInputRef.current.value = "";
        proxyInputRef.current.focus();
      }
    },
    [
      dataChannelRef,
      videoRef,
      proxyInputRef,
      getContentRect,
      isDataChannelOpen,
    ],
  );

  /**
   * Text input action
   */
  const handleTextInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isDataChannelOpen()) {
        return;
      }

      dataChannelRef.current!.send(
        JSON.stringify({
          type: "TEXT_INPUT",
          text: e.target.value,
        }),
      );
    },
    [dataChannelRef, isDataChannelOpen],
  );

  /**
   * Generic action
   */
  const sendAction = useCallback(
    (type: string) => {
      if (!isDataChannelOpen()) {
        return;
      }

      dataChannelRef.current!.send(
        JSON.stringify({
          type,
        }),
      );
    },
    [dataChannelRef, isDataChannelOpen],
  );

  /**
   * Mouse down
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = videoRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setIsScrolling(true);

      scrollStartRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    },
    [videoRef],
  );

  /**
   * Mouse up / gesture
   */
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isScrolling || !scrollStartRef.current || !isDataChannelOpen()) {
        return;
      }

      const start = scrollStartRef.current;

      const end = {
        x: e.clientX,
        y: e.clientY,
      };

      const dx = end.x - start.x;
      const dy = end.y - start.y;

      // Minimum swipe distance = 50px
      if (Math.abs(dy) > 50 || Math.abs(dx) > 50) {
        const contentRect = getContentRect();

        if (contentRect) {
          const startX =
            ((start.x - contentRect.left) / contentRect.width) * 1000;

          const startY =
            ((start.y - contentRect.top) / contentRect.height) * 1000;

          const endX = ((end.x - contentRect.left) / contentRect.width) * 1000;

          const endY = ((end.y - contentRect.top) / contentRect.height) * 1000;

          dataChannelRef.current!.send(
            JSON.stringify({
              type: "GESTURE",
              x: startX,
              y: startY,
              endX,
              endY,
            }),
          );
        }
      }

      setIsScrolling(false);
      scrollStartRef.current = null;
    },
    [dataChannelRef, getContentRect, isDataChannelOpen, isScrolling],
  );

  return {
    handleMouseMove,
    handleLoadedMetadata,
    handleClick,
    handleTextInput,
    sendAction,
    handleMouseDown,
    handleMouseUp,
    getContentRect,
    isScrolling,
  };
}

export default useAction;
