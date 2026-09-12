import { useQuery } from "@tanstack/react-query";
import { growthStrategyApi } from "../api/growth-strategy.api";

/** All growth strategies, for the onboarding "pick an existing one" step. */
function useGrowthStrategies() {
  const query = useQuery({
    queryKey: ["growth-strategies"],
    queryFn: () => growthStrategyApi.getAll(),
  });

  return {
    growthStrategies: query.data?.success ? (query.data.data ?? []) : [],
    isLoading: query.isLoading,
    error: query.data?.success === false ? query.data.message : null,
    refetch: query.refetch,
  };
}

export default useGrowthStrategies;
