import { useEffect, useState } from "react";

import { getDietaryIntake } from "../api/dashboard";
import { percentOf } from "../components/charts/chartHelpers";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import FullScreenLoader from "../components/FullScreenLoader";
import PageHeader from "../components/PageHeader";
import SectionHeader from "../components/SectionHeader";
import StackedFrequencyBar from "../components/StackedFrequencyBar";
import { FREQUENCY_CATEGORIES } from "../lib/dietaryFrequency";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import { useRefresh } from "../context/RefreshContext";
import type { DietaryFoodItem, DietaryIntakeResponse } from "../types/liveDashboard";

// Display-only English labels for the separate "Other Food Specified" open-
// ended item's own die_other_freq value (resolved by the backend as
// REDCap's Hindi-only choice text - see CLAUDE.md's "Known data
// characteristic" note). The 10 standard food-group bars/tables below use
// FREQUENCY_CATEGORIES (lib/dietaryFrequency.ts), keyed by REDCap's own
// stored code - the reliable source of truth; this dictionary exists only
// because the "Other Food Specified" table has no segment/code of its own
// to key off, just the backend's resolved label text.
const FREQUENCY_LABEL_EN: Record<string, string> = {
  "प्रतिदिन": "Daily",
  "सप्ताह में 3-6 बार": "3–6 times/week",
  "सप्ताह में 1-2 बार": "1–2 times/week",
  "15 दिनों में एक बार": "Once every 15 days",
  "मासिक": "Monthly",
  "6 महीने में एक बार": "Once every 6 months",
  "वार्षिक": "Annually",
  "शायद ही कभी/कभी नहीं": "Rarely/Never",
};

function toEnglishFrequencyLabel(label: string): string {
  return FREQUENCY_LABEL_EN[label] ?? label;
}

function FrequencyLegend() {
  return (
    <div className="freq-legend" role="list" aria-label="Consumption frequency categories">
      {FREQUENCY_CATEGORIES.map((cat) => (
        <div className="freq-legend-item" role="listitem" key={cat.code}>
          <span className="freq-legend-dot" style={{ background: cat.color }} />
          {cat.label}
        </div>
      ))}
    </div>
  );
}

function FoodGroupCard({ item }: { item: DietaryFoodItem }) {
  // Denominated against the study's overall enrolled cohort (222,
  // STUDY_ORIGINAL_ENROLLMENT - senior-confirmed static figure, see
  // lib/studyCohort.ts), not the live REDCap `total_registered` count -
  // same dashboard-wide "denominate against 222" rule already applied to
  // Overview/Health History. `missing` is recomputed locally against that
  // same 222 (never the backend's own total_registered-based missing_n),
  // so valid_n + missing always sums to exactly 222.
  const missing = Math.max(STUDY_ORIGINAL_ENROLLMENT - item.valid_n, 0);
  return (
    <div className="freq-food-group">
      <div className="freq-food-group-head">
        <h3 className="freq-food-group-title">{item.field_label}</h3>
        <span className="freq-food-group-n">
          n = {item.valid_n}
          {missing > 0 && ` · ${missing} missing/no response`}
        </span>
      </div>
      <StackedFrequencyBar foodGroupLabel={item.field_label} segments={item.segments} />
      <DetailDisclosure summary="View breakdown table">
        <table className="data-table freq-detail-table">
          <thead>
            <tr>
              <th>Frequency Category</th>
              <th>Children</th>
              <th>% of Valid Responses</th>
            </tr>
          </thead>
          <tbody>
            {FREQUENCY_CATEGORIES.map((cat) => {
              const seg = item.segments.find((s) => s.code === cat.code);
              return (
                <tr key={cat.code}>
                  <td>{cat.label}</td>
                  <td>{seg?.count ?? 0}</td>
                  <td>{seg?.percent ?? 0}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Valid responses (denominator)</td>
              <td>{item.valid_n}</td>
              <td>{percentOf(item.valid_n, STUDY_ORIGINAL_ENROLLMENT)}% of cohort</td>
            </tr>
            <tr>
              <td>Missing / no response</td>
              <td>{missing}</td>
              <td>{percentOf(missing, STUDY_ORIGINAL_ENROLLMENT)}% of cohort</td>
            </tr>
          </tfoot>
        </table>
      </DetailDisclosure>
    </div>
  );
}

export default function DietaryIntake() {
  const [data, setData] = useState<DietaryIntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  useEffect(() => {
    setError(null);
    getDietaryIntake()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount]);

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading Dietary Intake..." />;

  const { completion } = data;
  const otherFood = data.other_food_specified;

  return (
    <section className="dietary-intake-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="Dietary Intake"
        subtitle="How often each food group is consumed, reported directly by the study's live REDCap data."
      />

      <p className="dietary-completion-note">
        Assessment Status: {completion.completed}/{STUDY_ORIGINAL_ENROLLMENT}
      </p>

      <SectionHeader
        title="Food Consumption Frequency"
        note="Each bar = 100% of children with a valid response for that food group"
      />
      <FrequencyLegend />
      <div className="freq-food-group-grid">
        {data.items.map((item) => (
          <FoodGroupCard key={item.field_label} item={item} />
        ))}
      </div>

      <SectionHeader
        title="Other Food Specified"
        note="Separate from 'Other Vegetables'/'Other Fruits' above - one open-ended item, not aggregated"
      />
      <div className="table-card">
        <p className="chart-card-subtitle" style={{ padding: "var(--space-4) var(--space-4) 0" }}>
          {otherFood.valid_n}/{STUDY_ORIGINAL_ENROLLMENT} registered children specified an additional food (
          {percentOf(otherFood.valid_n, STUDY_ORIGINAL_ENROLLMENT)}%)
        </p>
        {otherFood.entries.length === 0 ? (
          <p className="chart-card-note" style={{ padding: "0 var(--space-4) var(--space-4)" }}>
            No children have specified an additional food item yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Food Name</th>
                <th>Portion Size</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {otherFood.entries.map((entry, index) => (
                <tr key={`${entry.food_name}-${index}`}>
                  <td>{entry.food_name}</td>
                  <td>{entry.portion_status === "recorded" ? entry.portion : entry.portion_status === "not_applicable" ? "Not applicable (rarely/never)" : "Not answered"}</td>
                  <td>{entry.frequency_status === "recorded" && entry.frequency ? toEnglishFrequencyLabel(entry.frequency) : "Not answered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
