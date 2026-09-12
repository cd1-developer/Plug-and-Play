"use client";

import OnboardingFlow from "./feature/Onboarding/component/onboarding-flow";
import useUnassignedPlacements from "./feature/placemenet/hook/useUnassignedPlacements";

export default function Home() {
  const { unassignedPlacements, isLoading } = useUnassignedPlacements();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black p-6">
      <OnboardingFlow placements={unassignedPlacements} isLoading={isLoading} />
    </div>
  );
}
