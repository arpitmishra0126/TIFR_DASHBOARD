import { useEffect, useState } from "react";

import { getPhysicalActivity } from "../api/dashboard";
import EmptyStateCard from "../components/EmptyStateCard";
import PageHeader from "../components/PageHeader";
import type { UnavailableModule } from "../types/liveDashboard";

export default function PhysicalActivity() {
  const [data, setData] = useState<UnavailableModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPhysicalActivity()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Study Assessment" title="Physical Activity (PAQ-A)" />
      {error && <p className="error-text">Could not reach backend: {error}</p>}
      {!error && !data && <p className="loading-text">Loading…</p>}
      {data && <EmptyStateCard data={data} />}
    </section>
  );
}
