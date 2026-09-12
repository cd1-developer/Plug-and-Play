import { useQuery } from "@tanstack/react-query";
import { dailyStatusApi } from "../api/daily-status.api";

/** Latest daily status row for a client account — used to show the current
 *  onboarding milestone (PENDING_LOGIN / VPN_CONNECTED / ...) in the UI. */
function useDailyStatus(clientAccountId: string | null) {
  const query = useQuery({
    queryKey: ["daily-status", clientAccountId],
    queryFn: () => dailyStatusApi.getLatest(clientAccountId!),
    enabled: clientAccountId !== null,
  });

  return {
    dailyStatus: query.data?.success ? query.data.data : undefined,
    refetch: query.refetch,
  };
}

export default useDailyStatus;
