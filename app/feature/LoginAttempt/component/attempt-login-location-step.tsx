"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorToast } from "@/components/Toasts";
import useLocation from "../hooks/useLocation";
import type { RankedVpnLocation } from "@/utils/service/LocationService";

interface AttemptLoginLocationStepProps {
  onContinue: (location: RankedVpnLocation) => void;
}

/** Step 1 — picks a VPN location closest to a given login location. */
function AttemptLoginLocationStep({
  onContinue,
}: AttemptLoginLocationStepProps) {
  const [city, setCity] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<string | undefined>(
    undefined,
  );
  const { getClosestVpnLocations, closestVpnLocations, isLoadingClosestVpnLocations } =
    useLocation();

  const handleFindNearest = async () => {
    if (!city.trim()) return ErrorToast("Enter a login location");
    setSelectedIndex(undefined);
    await getClosestVpnLocations({ city });
  };

  const handleContinue = () => {
    if (selectedIndex === undefined) return;
    onContinue(closestVpnLocations[Number(selectedIndex)]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-location">Login location</Label>
        <div className="flex gap-2">
          <Input
            id="login-location"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Amsterdam"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleFindNearest}
            disabled={isLoadingClosestVpnLocations}
          >
            Find nearest location
          </Button>
        </div>
      </div>

      {closestVpnLocations.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Nearest VPN locations</Label>
          <Select value={selectedIndex} onValueChange={setSelectedIndex}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              {closestVpnLocations.map((location, index) => (
                <SelectItem key={`${location.city}-${index}`} value={String(index)}>
                  <span className="flex items-center gap-2">
                    {location.city}, {location.country} —{" "}
                    {Math.round(location.distance)} km
                    {index === 0 && <Badge variant="secondary">Recommended</Badge>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        className="self-end"
        onClick={handleContinue}
        disabled={selectedIndex === undefined}
      >
        Continue
      </Button>
    </div>
  );
}

export default AttemptLoginLocationStep;
