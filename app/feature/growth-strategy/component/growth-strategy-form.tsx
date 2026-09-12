"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { successToast, ErrorToast } from "@/components/Toasts";
import type { GrowthStrategyPayload } from "../types/growth-strategy.interface";

interface GrowthStrategyFormProps {
  /** Parent owns the actual submission (assign a device to a new client
   *  account, then create the growth strategy for it) — this component only
   *  collects and validates input. */
  onSubmit: (
    username: string,
    payload: GrowthStrategyPayload,
  ) => Promise<{ success: boolean; message?: string }>;
  onCancel: () => void;
}

const textareaClassName = cn(
  "w-full min-h-16 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

const toList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** Onboarding step 1 — collects the client's growth strategy and saves it via
 *  POST /api/growth-strategy/:username. Password/2FA are never asked for. */
function GrowthStrategyForm({ onSubmit, onCancel }: GrowthStrategyFormProps) {
  const [username, setUsername] = useState("");
  const [loginLocation, setLoginLocation] = useState("");
  const [targetLocations, setTargetLocations] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [targetAccounts, setTargetAccounts] = useState("");
  const [maxFollowing, setMaxFollowing] = useState("");
  const [targetMale, setTargetMale] = useState(false);
  const [targetFemale, setTargetFemale] = useState(false);
  const [goals, setGoals] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [historyEvaluation, setHistoryEvaluation] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [howDidYouHear, setHowDidYouHear] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !loginLocation.trim()) {
      return ErrorToast("Instagram username and login location are required");
    }
    // Backend requires loginLocation.min(10) — a bare city name like "Rome" fails.
    if (loginLocation.trim().length < 10) {
      return ErrorToast("Login location must be at least 10 characters");
    }

    setIsSubmitting(true);
    const result = await onSubmit(username.trim(), {
      // ponytail: backend has no id-issuing endpoint, so we mint one client-side.
      growthStrategyId: crypto.randomUUID(),
      loginLocation: loginLocation.trim(),
      targetLocations: toList(targetLocations),
      hashtags: toList(hashtags),
      targetAccounts: toList(targetAccounts),
      // Prisma requires whiteList/blackList as String[] (not nullable) on create.
      whiteList: [],
      blackList: [],
      maxFollowing: maxFollowing ? Number(maxFollowing) : undefined,
      targetMale,
      targetFemale,
      goals: goals.trim() || undefined,
      currentStatus: currentStatus.trim() || undefined,
      historyEvaluation: historyEvaluation.trim() || undefined,
      additionalInfo: additionalInfo.trim() || undefined,
      howDidYouHear: howDidYouHear.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!result.success)
      return ErrorToast(result.message ?? "Something went wrong");
    successToast("Growth strategy saved");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Instagram username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your_instagram_handle"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="loginLocation">Login location</Label>
        <Input
          id="loginLocation"
          value={loginLocation}
          onChange={(e) => setLoginLocation(e.target.value)}
          placeholder="e.g. Paris, France"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="goals">Goals</Label>
        <textarea
          id="goals"
          className={textareaClassName}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="Grow to 10k followers"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentStatus">Current status</Label>
        <Input
          id="currentStatus"
          value={currentStatus}
          onChange={(e) => setCurrentStatus(e.target.value)}
          placeholder="1.2k followers"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="targetLocations">
          Target locations (comma separated)
        </Label>
        <Input
          id="targetLocations"
          value={targetLocations}
          onChange={(e) => setTargetLocations(e.target.value)}
          placeholder="Mumbai, Delhi"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hashtags">Hashtags (comma separated)</Label>
        <Input
          id="hashtags"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#fitness"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="targetAccounts">
          Target accounts (comma separated)
        </Label>
        <Input
          id="targetAccounts"
          value={targetAccounts}
          onChange={(e) => setTargetAccounts(e.target.value)}
          placeholder="some_big_account"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="maxFollowing">Max following</Label>
        <Input
          id="maxFollowing"
          type="number"
          value={maxFollowing}
          onChange={(e) => setMaxFollowing(e.target.value)}
          placeholder="5000"
        />
      </div>

      <div className="flex gap-6">
        <Label className="cursor-pointer">
          <input
            type="checkbox"
            checked={targetMale}
            onChange={(e) => setTargetMale(e.target.checked)}
          />
          Target male
        </Label>
        <Label className="cursor-pointer">
          <input
            type="checkbox"
            checked={targetFemale}
            onChange={(e) => setTargetFemale(e.target.checked)}
          />
          Target female
        </Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="historyEvaluation">History evaluation</Label>
        <textarea
          id="historyEvaluation"
          className={textareaClassName}
          value={historyEvaluation}
          onChange={(e) => setHistoryEvaluation(e.target.value)}
          placeholder="Previously used bots"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="howDidYouHear">How did you hear about us?</Label>
        <Input
          id="howDidYouHear"
          value={howDidYouHear}
          onChange={(e) => setHowDidYouHear(e.target.value)}
          placeholder="Referral"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="additionalInfo">Additional info</Label>
        <textarea
          id="additionalInfo"
          className={textareaClassName}
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

export default GrowthStrategyForm;
