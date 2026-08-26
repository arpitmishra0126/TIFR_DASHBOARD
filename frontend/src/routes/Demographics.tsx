import { useEffect, useMemo, useState } from "react";

import { getDemographics } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import FilterBar from "../components/FilterBar";
import HorizontalBarChart from "../components/HorizontalBarChart";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import { usePopulation } from "../hooks/usePopulation";
import {
  ageDistribution,
  applyFilters,
  distinctVillages,
  sexDistribution,
  villageDistribution,
  type PopulationFilters,
} from "../lib/populationAnalytics";
import type { DemographicsResponse } from "../types/liveDashboard";

export default function Demographics() {
  const [data, setData] = useState<DemographicsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PopulationFilters>({});
  const { children, error: populationError } = usePopulation();
  const { version } = useRefresh();

  useEffect(() => {
    getDemographics()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version]);

  const filtered = useMemo(() => (children ? applyFilters(children, filters) : []), [children, filters]);
  const villageOptions = useMemo(() => (children ? distinctVillages(children) : []), [children]);
  const isFiltered = Boolean(filters.sex || filters.ageGroup || filters.village || filters.status);

  if (error) return <p className="error-text">Could not reach backend: {error}</p>;
  if (!data) return <p className="loading-text">Loading…</p>;

  const udaiData = data.udai_pareek_category_distribution.map((c) => ({ label: `Category ${c.code}`, count: c.count }));
  const prasadData = data.bg_prasad_category_distribution.map((c) => ({ label: `Category ${c.code}`, count: c.count }));

  return (
    <section>
      <PageHeader
        eyebrow="Study Population"
        title="Demographics & SES Profile"
        subtitle="Who the study population is, and their socioeconomic profile."
      />

      <SectionHeader
        title="Population breakdown"
        note={isFiltered ? `${filtered.length} of ${children?.length ?? 0} shown` : undefined}
      />
      <FilterBar filters={filters} onChange={setFilters} villageOptions={villageOptions} />

      {populationError && <p className="error-text">Could not load population data: {populationError}</p>}

      {children && (
        <div className="chart-grid">
          <ChartCard title="Sex distribution">
            <CategoryBarChart data={sexDistribution(filtered)} mode="categorical" />
          </ChartCard>
          <ChartCard title="Age distribution" subtitle="Years, derived from date of birth">
            <CategoryBarChart data={ageDistribution(filtered)} mode="sequential" />
          </ChartCard>
          <ChartCard title="Geographic distribution" subtitle="By village, top 8 shown">
            <HorizontalBarChart data={villageDistribution(filtered)} mode="sequential" />
          </ChartCard>
        </div>
      )}

      <SectionHeader
        title="Socioeconomic status"
        note={`n=${data.ses_profile_count} with SES questionnaire completed — not affected by filters above`}
      />

      <div className="kpi-row" style={{ marginBottom: "var(--space-4)" }}>
        {data.per_capita_income_summary && (
          <KpiCard
            label="Mean per-capita income"
            value={`₹${Math.round(data.per_capita_income_summary.mean).toLocaleString()}`}
            sublabel={`n=${data.per_capita_income_summary.count}`}
          />
        )}
        {data.household_size_summary && (
          <KpiCard
            label="Mean household size"
            value={data.household_size_summary.mean}
            sublabel={`n=${data.household_size_summary.count}`}
          />
        )}
      </div>

      <div className="chart-grid two-col">
        <ChartCard title="Udai Pareek SES category" note={data.notes.udai_pareek_category}>
          <HorizontalBarChart data={udaiData} />
        </ChartCard>
        <ChartCard title="BG Prasad category" note={data.notes.bg_prasad_category}>
          <HorizontalBarChart data={prasadData} />
        </ChartCard>
      </div>
    </section>
  );
}
