import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { getOverview } from "../api/dashboard";

interface RefreshContextValue {
  /** Bumped after each successful forced refresh — pages depend on this to refetch. */
  version: number;
  lastUpdated: Date | null;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      // A single forced call is enough: the backend's REDCap cache is a
      // shared, process-wide instance, so busting it here refreshes the
      // data every page's own (non-forced) fetch will see afterwards.
      await getOverview({ force: true });
      setLastUpdated(new Date());
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh live REDCap data.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ version, lastUpdated, refreshing, error, refresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh(): RefreshContextValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within a RefreshProvider");
  return ctx;
}
