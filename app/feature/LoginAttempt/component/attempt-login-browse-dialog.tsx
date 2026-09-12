"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppDialog } from "@/components/AppDialog";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import useChangeVpnLocation from "../hooks/useChangeVpnLocation";
import type { UnassignedPlacement } from "../../placemenet/hook/useUnassignedPlacements";
import AttemptLoginLocationStep from "./attempt-login-location-step";
import AttemptLoginRemoteControlStep from "./attempt-login-remote-control-step";
import LiveDeviceScreenshot from "./live-device-screenshot";
import { useAppSelector } from "@/store/storeConfig";
import type { RankedVpnLocation } from "@/utils/service/LocationService";

interface AttemptLoginBrowseDialogProps {
  placements: UnassignedPlacement[];
  isLoading: boolean;
}

type FlowStep =
  | "location"
  | "connecting-vpn"
  | "vpn-failed"
  | "remote-control";

type VpnConnectionStatus = "idle" | "connecting" | "connected" | "failed";

/** "1. VPN location" / "2. Remote control" progress indicator. */
function LoginFlowStepper({ activeStep }: { activeStep: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {(["VPN location", "Remote control"] as const).map((label, i) => (
        <span
          key={label}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium",
            activeStep === i + 1
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}

/** Browse unassigned placements, then pick one at random — among connected devices only — to
 *  run through a single VPN location → Remote Control (WebRTC) hand-off. Once the VPN is
 *  connected, the operator logs the account in themselves over a live remote-control session
 *  instead of the app automating credentials/2FA. */
function AttemptLoginBrowseDialog({
  placements,
  isLoading,
}: AttemptLoginBrowseDialogProps) {
  const [pickedPlacement, setPickedPlacement] =
    useState<UnassignedPlacement | null>(null);
  const [selectedVpnLocation, setSelectedVpnLocation] =
    useState<RankedVpnLocation | null>(null);
  const [vpnConnectionStatus, setVpnConnectionStatus] =
    useState<VpnConnectionStatus>("idle");
  const { changeVpnLocation } = useChangeVpnLocation();
  const flowDeviceId = pickedPlacement?.deviceId ?? null;
  const automation = useAppSelector((state) =>
    flowDeviceId ? state.devices[flowDeviceId]?.automation : undefined,
  );

  const connectedPlacements = placements.filter(
    (p) => p.connected && !p.isRunning,
  );

  // Watch the device's own report of the "Change Vpn Location" run we kicked
  // off — only once it reports COMPLETED do we consider the VPN connected and
  // hand the device over to the operator via Remote Control.
  useEffect(() => {
    if (vpnConnectionStatus !== "connecting") return;
    // Android stores AutomationEntity.automationType as the Kotlin enum's
    // `.name` (VpnAutomationManager.kt) — SCREAMING_SNAKE_CASE, not the
    // "Change Vpn Location" display string @SerialName only applies to
    // wire (de)serialization of the enum itself, not a manual `.name` read.
    if (automation?.automationType !== "CHANGE_VPN_LOCATION") return;
    if (automation.status === "COMPLETED") setVpnConnectionStatus("connected");
    else if (automation.status === "FAILED") setVpnConnectionStatus("failed");
  }, [vpnConnectionStatus, automation?.automationType, automation?.status]);

  const step: FlowStep | null =
    pickedPlacement === null
      ? null
      : vpnConnectionStatus === "idle"
        ? "location"
        : vpnConnectionStatus === "connecting"
          ? "connecting-vpn"
          : vpnConnectionStatus === "failed"
            ? "vpn-failed"
            : "remote-control";

  const flowPlacementName = pickedPlacement?.placementName ?? null;

  const handleAttemptLogin = () => {
    const index = Math.floor(Math.random() * connectedPlacements.length);
    setPickedPlacement(connectedPlacements[index]);
    setVpnConnectionStatus("idle");
  };

  const handleLocationContinue = (location: RankedVpnLocation) => {
    if (!pickedPlacement?.deviceId) return;
    setSelectedVpnLocation(location);
    setVpnConnectionStatus("connecting");
    changeVpnLocation({
      deviceId: pickedPlacement.deviceId,
      vpnLocation: location.city,
    });
  };

  const handleRetryVpnConnection = () => {
    if (!selectedVpnLocation) return setVpnConnectionStatus("idle");
    handleLocationContinue(selectedVpnLocation);
  };

  const resetFlow = () => {
    setPickedPlacement(null);
    setSelectedVpnLocation(null);
    setVpnConnectionStatus("idle");
  };

  const handleFlowOpenChange = (next: boolean) => {
    if (!next) resetFlow();
  };

  return (
    <>
      <Button
        onClick={handleAttemptLogin}
        disabled={isLoading || connectedPlacements.length === 0}
      >
        Attempt login
      </Button>

      <AppDialog
        open={step !== null}
        onOpenChange={handleFlowOpenChange}
        contentClassName="sm:max-w-3xl"
        title="Attempt login"
        description={
          flowPlacementName
            ? `Placement ${flowPlacementName} (device ${flowDeviceId})`
            : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <LoginFlowStepper
            activeStep={
              step === "location" ||
              step === "connecting-vpn" ||
              step === "vpn-failed"
                ? 1
                : 2
            }
          />
          {step === "remote-control" && flowDeviceId ? (
            <ErrorBoundary>
              <AttemptLoginRemoteControlStep
                deviceId={flowDeviceId}
                onFinish={resetFlow}
              />
            </ErrorBoundary>
          ) : (
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">
                {step === "location" && (
                  <AttemptLoginLocationStep onContinue={handleLocationContinue} />
                )}

                {step === "connecting-vpn" && (
                  <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    Connecting to {selectedVpnLocation?.city}
                    {selectedVpnLocation
                      ? `, ${selectedVpnLocation.country}`
                      : ""}
                    …
                  </div>
                )}

                {step === "vpn-failed" && (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-red-500">
                      Couldn&apos;t connect to{" "}
                      {selectedVpnLocation?.city ?? "the selected location"}.
                    </p>
                    <Button
                      className="self-end"
                      onClick={handleRetryVpnConnection}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>

              <LiveDeviceScreenshot deviceId={flowDeviceId} />
            </div>
          )}
        </div>
      </AppDialog>
    </>
  );
}

export default AttemptLoginBrowseDialog;
