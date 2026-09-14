"use client";

import OnboardingFlow from "./feature/Onboarding/component/onboarding-flow";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black p-6">
      <OnboardingFlow />
    </div>
  );
}
