"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorToast } from "@/components/Toasts";
import { dailyStatusApi } from "@/app/feature/daily-status/api/daily-status.api";
import useDailyStatus from "@/app/feature/daily-status/hook/useDailyStatus";
import type { GrowthStrategy } from "@/app/feature/growth-strategy/types/growth-strategy.interface";
import AttemptLoginRemoteControlStep from "@/app/feature/LoginAttempt/component/attempt-login-remote-control-step";
import LiveDeviceScreenshot from "@/app/feature/LoginAttempt/component/live-device-screenshot";
import useChangeVpnLocation from "@/app/feature/LoginAttempt/hooks/useChangeVpnLocation";
import useLocation from "@/app/feature/LoginAttempt/hooks/useLocation";
import usePlacementForClientAccount from "@/app/feature/placemenet/hook/usePlacementForClientAccount";
import useUnassignedPlacements from "@/app/feature/placemenet/hook/useUnassignedPlacements";
import { placementApi } from "@/app/feature/placemenet/api/placement.api";
import {
  isDeviceConnected,
  type PlacementWithDeviceStatus,
} from "@/app/feature/placemenet/utils/placement-device-status";
import { useAppSelector } from "@/store/storeConfig";
import type { RankedVpnLocation } from "@/utils/service/LocationService";

interface GrowthStrategyDetailPanelProps {
  strategy: GrowthStrategy;
}

type SubStage = "idle" | "connecting-vpn" | "vpn-failed" | "remote-control";

const todayDate = () => new Date().toISOString().slice(0, 10);

/** Right-side panel — what to show and which action is valid is driven by the
 *  growth strategy's *server* daily status (PENDING_LOGIN / VPN_CONNECTED),
 *  not local wizard state. "connecting-vpn"/"vpn-failed" are local, transient
 *  sub-stages layered on top of PENDING_LOGIN while a VPN change is in flight —
 *  the status only actually flips to VPN_CONNECTED once the device automation
 *  reports COMPLETED. */
function GrowthStrategyDetailPanel({
  strategy,
}: GrowthStrategyDetailPanelProps) {
  const clientAccountId = strategy.clientAccountId;

  const { dailyStatus, refetch: refetchDailyStatus } =
    useDailyStatus(clientAccountId);
  const { placement } = usePlacementForClientAccount(clientAccountId);

  // The client account is created device-less (at growth-strategy submit), so
  // it has no placement until its VPN connects. Until then we pick a free
  // unassigned placement to run this session's VPN/remote-control on; the
  // pairing is local only. Once the VPN connects we bind the account to that
  // placement server-side (placementApi.assignClientAccount, in the effect
  // below), after which usePlacementForClientAccount resolves it for good.
  const [fallbackPlacement, setFallbackPlacement] =
    useState<PlacementWithDeviceStatus | null>(null);
  const effectivePlacement = placement ?? fallbackPlacement;
  const deviceId = effectivePlacement?.deviceId ?? null;

  const { unassignedPlacements, isLoading: isLoadingUnassigned } =
    useUnassignedPlacements({ enabled: !deviceId });
  const freeUnassignedPlacements = unassignedPlacements.filter(
    (p) => p.connected && !p.isRunning,
  );

  const device = useAppSelector((state) =>
    deviceId ? state.devices[deviceId] : undefined,
  );
  const automation = device?.automation;
  const isDeviceOnline = isDeviceConnected(device);
  console.log(isDeviceOnline);

  const [subStage, setSubStage] = useState<SubStage>("idle");
  const [vpnLocation, setVpnLocation] = useState<RankedVpnLocation | null>(
    null,
  );
  // Guards the completion effect below: "connecting-vpn" is entered before the
  // nearest-location lookup resolves, so `automation` can still be a *stale*
  // COMPLETED from a previous run on this device during that gap. Only trust
  // an automation event once we've actually sent this attempt's own command.
  const vpnCommandSentRef = useRef(false);

  const { changeVpnLocation } = useChangeVpnLocation();
  const { getClosestVpnLocations } = useLocation();

  // Switching strategies abandons any in-progress local sub-stage for the
  // previous one — the underlying device automation keeps running server-side
  // regardless, this just stops showing stale UI for it.
  useEffect(() => {
    setSubStage("idle");
    setVpnLocation(null);
    setFallbackPlacement(null);
    vpnCommandSentRef.current = false;
  }, [strategy.id]);

  useEffect(() => {
    if (subStage !== "connecting-vpn") return;
    if (!vpnCommandSentRef.current) return;
    if (automation?.automationType !== "CHANGE_VPN_LOCATION") return;
    if (automation.status === "COMPLETED") {
      vpnCommandSentRef.current = false;
      setSubStage("idle");
      // VPN is up on this device — NOW bind the device-less client account to
      // this placement, THEN advance the daily status to VPN_CONNECTED. This
      // is the deferred assignment: the account existed without a device until
      // its VPN connected.
      const placementId = effectivePlacement?.id;
      void (async () => {
        if (clientAccountId && placementId) {
          const bound = await placementApi.assignClientAccount(
            placementId,
            clientAccountId,
          );
          if (!bound.success) {
            ErrorToast(bound.message ?? "Failed to assign device to account");
          }
        }
        if (clientAccountId) {
          const result = await dailyStatusApi.upsert(
            clientAccountId,
            todayDate(),
            "VPN_CONNECTED",
          );
          if (!result.success) {
            ErrorToast(result.message ?? "Failed to update status");
          }
          refetchDailyStatus();
        }
      })();
    } else if (automation.status === "FAILED") {
      vpnCommandSentRef.current = false;
      setSubStage("vpn-failed");
    }
  }, [
    subStage,
    automation?.automationType,
    automation?.status,
    clientAccountId,
    effectivePlacement?.id,
    refetchDailyStatus,
  ]);

  const startVpnConnect = async () => {
    let target = effectivePlacement;
    if (!target) {
      if (isLoadingUnassigned) {
        return ErrorToast(
          "Still checking for an available device — try again in a moment",
        );
      }
      if (freeUnassignedPlacements.length === 0) {
        return ErrorToast("No free device is available right now");
      }
      target =
        freeUnassignedPlacements[
          Math.floor(Math.random() * freeUnassignedPlacements.length)
        ];
      setFallbackPlacement(target);
    }
    if (!target.deviceId) return ErrorToast("Selected placement has no device");
    if (!strategy.loginLocation) {
      return ErrorToast("This growth strategy has no login location set");
    }
    if (!target.connected) return ErrorToast("Device is currently offline");
    if (target.isRunning) {
      return ErrorToast("Device is already running another automation");
    }

    vpnCommandSentRef.current = false;
    setSubStage("connecting-vpn");
    const nearest = await getClosestVpnLocations({
      city: strategy.loginLocation,
    });
    const closest = nearest[0] ?? null;
    setVpnLocation(closest);
    if (!closest) return setSubStage("vpn-failed");
    // Only from here on is a "COMPLETED" automation event trustworthy — it's
    // the device's own websocket report of the run we just kicked off, not a
    // leftover from an earlier one.
    vpnCommandSentRef.current = true;
    changeVpnLocation({ deviceId: target.deviceId, vpnLocation: closest.city });
  };

  const handleRetryVpn = () => startVpnConnect();

  if (subStage === "remote-control" && deviceId) {
    if (!isDeviceOnline) {
      return (
        <p className="max-w-md text-sm text-muted-foreground">
          Sorry, the device is currently offline. We&apos;re trying to get the
          device back online as soon as possible.
        </p>
      );
    }
    return (
      <ErrorBoundary>
        <AttemptLoginRemoteControlStep
          deviceId={deviceId}
          onFinish={() => setSubStage("idle")}
          onLoginSuccess={() => {
            // Home screen reached — mark the account logged in now. Closing the
            // session is left to the step's post-login grace timer (or the
            // operator's Terminate button), so don't setSubStage("idle") here.
            if (!clientAccountId) return;
            dailyStatusApi
              .upsert(clientAccountId, todayDate(), "LOGIN_SUCCESSFULL")
              .then((result) => {
                if (!result.success)
                  ErrorToast(result.message ?? "Failed to update status");
                refetchDailyStatus();
              });
          }}
        />
      </ErrorBoundary>
    );
  }

  const status = dailyStatus?.status;

  return (
    <div className="flex flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 className="text-lg font-semibold">{strategy.growthStrategyId}</h2>

        {!status && (
          <p className="text-sm text-muted-foreground">
            No status yet for this account.
          </p>
        )}

        {status === "PENDING_LOGIN" && (
          <>
            <p className="text-sm text-muted-foreground">
              Status: Pending for login
            </p>
            {subStage === "connecting-vpn" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Connecting to {vpnLocation?.city ?? strategy.loginLocation}
                {vpnLocation ? `, ${vpnLocation.country}` : ""}…
              </div>
            )}
            {subStage === "vpn-failed" && (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-red-500">
                  Couldn&apos;t connect to{" "}
                  {vpnLocation?.city ?? strategy.loginLocation}.
                </p>
                <Button onClick={handleRetryVpn}>Retry</Button>
              </div>
            )}
            {subStage === "idle" && (
              <>
                {!deviceId && (
                  <p className="text-xs text-muted-foreground">
                    No device linked yet — a free one will be picked
                    automatically.
                  </p>
                )}
                <Button onClick={startVpnConnect}>Login your account</Button>
              </>
            )}
          </>
        )}

        {status === "VPN_CONNECTED" && (
          <>
            <p className="text-sm text-muted-foreground">
              Status: VPN connected
            </p>
            <p>VPN connected — Waiting for account to login.</p>
            {isDeviceOnline ? (
              <Button onClick={() => setSubStage("remote-control")}>
                Connect device
              </Button>
            ) : (
              <p className="text-sm text-red-500">
                Sorry, the device is currently offline. We&apos;re trying to get
                the device back online as soon as possible.
              </p>
            )}
          </>
        )}

        {status && status !== "PENDING_LOGIN" && status !== "VPN_CONNECTED" && (
          <p className="text-sm text-muted-foreground">Status: {status}</p>
        )}
      </div>
      {subStage === "connecting-vpn" && (
        <LiveDeviceScreenshot deviceId={deviceId} />
      )}
    </div>
  );
}

export default GrowthStrategyDetailPanel;
