import { useEffect, useState } from "react";

import { getHealthScreening } from "../api/dashboard";
import EmptyStateCard from "../components/EmptyStateCard";
import PageHeader from "../components/PageHeader";
import type { UnavailableModule } from "../types/liveDashboard";

export default function HealthScreening() {
  const [data, setData] = useState<UnavailableModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealthScreening()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Study Assessment" title="Health & Screening" />
      {error && <p className="error-text">Could not reach backend: {error}</p>}
      {!error && !data && <p className="loading-text">Loading…</p>}
      {data && <EmptyStateCard data={data} />}
    </section>
  );
}
