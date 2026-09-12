"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import useGrowthStrategies from "../hook/useGrowthStrategies";

interface GrowthStrategyListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

/** Left-side panel — every growth strategy, persistently visible. Selecting one
 *  drives the right-side detail panel; it carries `clientAccountId` itself, so
 *  no extra lookup is needed here. */
function GrowthStrategyList({ selectedId, onSelect, onCreateNew }: GrowthStrategyListProps) {
  const { growthStrategies, isLoading } = useGrowthStrategies();

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 border-r pr-4">
      <Button type="button" onClick={onCreateNew}>
        New growth strategy
      </Button>

      <div className="flex flex-col gap-1 overflow-y-auto">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {!isLoading && growthStrategies.length === 0 && (
          <p className="text-sm text-muted-foreground">No growth strategies yet.</p>
        )}
        {growthStrategies.map((strategy) => (
          <button
            key={strategy.id}
            type="button"
            onClick={() => onSelect(strategy.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              strategy.id === selectedId
                ? "border-primary bg-primary/10 font-medium"
                : "border-transparent hover:bg-muted",
            )}
          >
            <div className="truncate">{strategy.growthStrategyId}</div>
            {strategy.loginLocation && (
              <div className="truncate text-xs text-muted-foreground">
                {strategy.loginLocation}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default GrowthStrategyList;
