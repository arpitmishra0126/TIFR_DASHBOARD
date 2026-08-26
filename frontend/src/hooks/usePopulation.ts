import { useEffect, useState } from "react";

import { getRegistry } from "../api/dashboard";
import type { RegistryChild } from "../types/liveDashboard";

const PAGE_SIZE = 500;

/**
 * Loads the full registered-child population once, via the existing
 * /dashboard/registry endpoint (paginated client-side), so Overview and
 * Demographics can offer real cross-population filters (sex, age group,
 * village, status) without any backend change.
 */
export function usePopulation() {
  const [children, setChildren] = useState<RegistryChild[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const first = await getRegistry({ limit: PAGE_SIZE, offset: 0 });
        const all = [...first.children];
        const offsets: number[] = [];
        for (let offset = PAGE_SIZE; offset < first.total; offset += PAGE_SIZE) {
          offsets.push(offset);
        }
        const rest = await Promise.all(offsets.map((offset) => getRegistry({ limit: PAGE_SIZE, offset })));
        for (const page of rest) all.push(...page.children);
        if (!cancelled) setChildren(all);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { children, error };
}
