import { useEffect, useMemo, useState } from "react";

import { getDemographics } from "../api/dashboard";
import CategoryBarChart from "../components/CategoryBarChart";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import FilterBar from "../components/FilterBar";
import HorizontalBarChart, { computeHorizontalBarChartHeight } from "../components/HorizontalBarChart";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StudyDataLoader from "../components/StudyDataLoader";
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
  const [retryCount, setRetryCount] = useState(0);
  const [filters, setFilters] = useState<PopulationFilters>({});
  const { children, error: populationError } = usePopulation();
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getDemographics()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  const filtered = useMemo(() => (children ? applyFilters(children, filters) : []), [children, filters]);
  const villageOptions = useMemo(() => (children ? distinctVillages(children) : []), [children]);
  const isFiltered = Boolean(filters.sex || filters.ageGroup || filters.village || filters.status);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <StudyDataLoader label="Loading demographics data" subLabel="Connecting to live REDCap data…" />;

  const udaiData = data.udai_pareek_category_distribution.map((c) => ({ label: c.code, count: c.count }));
  const prasadData = data.bg_prasad_category_distribution.map((c) => ({ label: c.code, count: c.count }));
  // Shared height so the two side-by-side SES charts line up even if one
  // has fewer represented categories than the other (a category with zero
  // respondents isn't included in either distribution).
  const sesChartHeight = computeHorizontalBarChartHeight([udaiData, prasadData]);

  return (
    <section className="demographics-page">
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
        <>
          <div className="chart-grid two-col">
            <ChartCard title="Sex Distribution" compact>
              <CategoryBarChart data={sexDistribution(filtered)} mode="categorical" showPercent yAxisLabel="Number of children" />
            </ChartCard>
            <ChartCard title="Age Distribution" subtitle="Years, derived from date of birth" compact>
              <CategoryBarChart data={ageDistribution(filtered)} mode="sequential" showPercent yAxisLabel="Number of children" />
            </ChartCard>
          </div>

          <div className="chart-grid">
            <ChartCard title="Geographic Distribution" subtitle="By village, top 8 shown" compact>
              <HorizontalBarChart data={villageDistribution(filtered)} mode="sequential" height={340} />
            </ChartCard>
          </div>
        </>
      )}

      <SectionHeader
        title="Socioeconomic Status"
        note={`n=${data.ses_profile_count} with SES questionnaire completed - not affected by filters above`}
      />

      <div className="kpi-row ses-metric-row">
        {data.per_capita_income_summary && (
          <KpiCard
            label="Mean Per-Capita Income"
            value={`₹${Math.round(data.per_capita_income_summary.mean).toLocaleString()}`}
            sublabel={`n=${data.per_capita_income_summary.count}`}
            tone="blue"
          />
        )}
        {data.household_size_summary && (
          <KpiCard
            label="Mean Household Size"
            value={data.household_size_summary.mean}
            sublabel={`n=${data.household_size_summary.count}`}
            tone="aqua"
          />
        )}
      </div>

      <div className="chart-grid two-col">
        <ChartCard title="Udai Pareek SES Category" compact>
          <HorizontalBarChart data={udaiData} mode="sequential" height={sesChartHeight} />
        </ChartCard>
        <ChartCard title="BG Prasad Category" compact>
          <HorizontalBarChart data={prasadData} mode="sequential" height={sesChartHeight} />
        </ChartCard>
      </div>
    </section>
  );
}
