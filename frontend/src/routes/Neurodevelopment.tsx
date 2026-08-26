import { useEffect, useState } from "react";

import { getNeurodevelopment } from "../api/dashboard";
import EmptyStateCard from "../components/EmptyStateCard";
import PageHeader from "../components/PageHeader";
import type { UnavailableModule } from "../types/liveDashboard";

export default function Neurodevelopment() {
  const [data, setData] = useState<UnavailableModule | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNeurodevelopment()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Study Assessment" title="Neurodevelopment / Assessment" />
      {error && <p className="error-text">Could not reach backend: {error}</p>}
      {!error && !data && <p className="loading-text">Loading…</p>}
      {data && <EmptyStateCard data={data} />}
    </section>
  );
}
