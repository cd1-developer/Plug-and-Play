"use client";

import { useEffect, useState } from "react";
import { ErrorToast } from "@/components/Toasts";
import { clientAccountApi } from "@/app/feature/client-account/api/client-account.api";
import { dailyStatusApi } from "@/app/feature/daily-status/api/daily-status.api";
import { growthStrategyApi } from "@/app/feature/growth-strategy/api/growth-strategy.api";
import GrowthStrategyForm from "@/app/feature/growth-strategy/component/growth-strategy-form";
import GrowthStrategyList from "@/app/feature/growth-strategy/component/growth-strategy-list";
import useGrowthStrategies from "@/app/feature/growth-strategy/hook/useGrowthStrategies";
import type { GrowthStrategyPayload } from "@/app/feature/growth-strategy/types/growth-strategy.interface";
import type { UnassignedPlacement } from "@/app/feature/placemenet/hook/useUnassignedPlacements";
import GrowthStrategyDetailPanel from "./growth-strategy-detail-panel";

const todayDate = () => new Date().toISOString().slice(0, 10);

interface OnboardingFlowProps {
  placements: UnassignedPlacement[];
  isLoading: boolean;
}

type ViewMode = "detail" | "form";

/** Growth-strategy list (left) + status-driven detail/action panel (right).
 *  Creating a new strategy: pick a free device -> connect it to a (new)
 *  client account -> create the growth strategy for that account -> mark
 *  PENDING_LOGIN. The rest of the login flow (VPN connect, remote control)
 *  lives in GrowthStrategyDetailPanel, driven by the selected strategy's
 *  daily status. */
function OnboardingFlow({ placements, isLoading }: OnboardingFlowProps) {
  const {
    growthStrategies,
    isLoading: isLoadingStrategies,
    refetch: refetchStrategies,
  } = useGrowthStrategies();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("detail");

  const selectedStrategy =
    growthStrategies.find((s) => s.id === selectedId) ?? null;

  // If the selected strategy disappears from the list, drop the stale
  // selection instead of showing a dead detail panel for it.
  useEffect(() => {
    if (!selectedId || isLoadingStrategies) return;
    if (!growthStrategies.some((s) => s.id === selectedId)) {
      setSelectedId(null);
      ErrorToast("This growth strategy is no longer available");
    }
  }, [selectedId, growthStrategies, isLoadingStrategies]);

  const handleCreateNew = async (
    username: string,
    payload: GrowthStrategyPayload,
  ) => {
    if (isLoading) {
      return {
        success: false,
        message: "Still loading available devices — try again in a moment",
      };
    }
    const available = placements.filter((p) => p.connected && !p.isRunning);
    console.log(available);
    if (available.length === 0) {
      return {
        success: false,
        message:
          "No physical device is available right now — we'll assign one and get back to you soon.",
      };
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    console.log("Randomly picked placement:", picked);
    if (!picked.deviceId) {
      return { success: false, message: "Selected placement has no device" };
    }

    const assigned = await clientAccountApi.assign(picked.id, username);
    if (!assigned.success || !assigned.data) {
      return {
        success: false,
        message:
          assigned.message ?? "Failed to connect device to client account",
      };
    }

    const created = await growthStrategyApi.create(
      assigned.data.igUsername,
      payload,
    );
    if (!created.success || !created.data) {
      return {
        success: false,
        message: created.message ?? "Failed to save growth strategy",
      };
    }

    const statusResult = await dailyStatusApi.upsert(
      created.data.clientAccountId,
      todayDate(),
      "PENDING_LOGIN",
    );
    if (!statusResult.success) {
      ErrorToast(statusResult.message ?? "Failed to update status");
    }

    await refetchStrategies();
    setSelectedId(created.data.id);
    setViewMode("detail");
    return { success: true };
  };

  return (
    <div className="flex w-full max-w-5xl gap-6">
      <GrowthStrategyList
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setViewMode("detail");
        }}
        onCreateNew={() => setViewMode("form")}
      />

      <div className="flex flex-1 items-start pt-1">
        {viewMode === "form" && (
          <GrowthStrategyForm
            onSubmit={handleCreateNew}
            onCancel={() => setViewMode("detail")}
          />
        )}
        {viewMode === "detail" && selectedStrategy && (
          <GrowthStrategyDetailPanel strategy={selectedStrategy} />
        )}
        {viewMode === "detail" && !selectedStrategy && (
          <p className="text-sm text-muted-foreground">
            Select a growth strategy from the list, or create a new one.
          </p>
        )}
      </div>
    </div>
  );
}

export default OnboardingFlow;
