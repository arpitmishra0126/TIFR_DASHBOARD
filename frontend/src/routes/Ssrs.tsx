import { useEffect, useMemo, useState } from "react";

import { getRegistry, getSsrs } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import FullScreenLoader from "../components/FullScreenLoader";
import GroupedBarChart from "../components/charts/GroupedBarChart";
import { IconClipboardAlert } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import PercentStackedBar from "../components/PercentStackedBar";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import type { SsrsItemResponse, SsrsRespondent, SsrsResponse, SsrsTeacherCompetenceItem } from "../types/liveDashboard";

// Fixed 3-level scale colours, shared by every frequency/importance bar -
// position 0/1/2 (not semantic good/bad - SSRS items mix positive and
// concerning behaviours, so "Very Often" is never coloured as "bad").
const SCALE_COLORS = ["var(--series-1)", "var(--series-4)", "var(--series-violet)"];
const AGE_BAND_OPTIONS = ["8 years", "9 years", "10 years", "Other", "Unknown"];
const RESPONDENT_TABS: { key: SsrsRespondent; label: string }[] = [
  { key: "parent", label: "Parent" },
  { key: "child", label: "Child" },
  { key: "teacher", label: "Teacher" },
];

function ScaleLegend({ segments }: { segments: { code: string; label: string }[] }) {
  return (
    <div className="freq-legend" role="list" aria-label="Response scale">
      {segments.map((s, i) => (
        <div className="freq-legend-item" role="listitem" key={s.code}>
          <span className="freq-legend-dot" style={{ background: SCALE_COLORS[i % SCALE_COLORS.length] }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function ItemResponseRow({ item }: { item: SsrsItemResponse }) {
  return (
    <div className="ssrs-item-row">
      <div className="ssrs-item-row-head">
        <span className="ssrs-item-row-label">{item.label || item.item_key}</span>
        <span className="ssrs-item-row-n">n={item.frequency.valid_n} answered</span>
      </div>
      <div className="ssrs-item-row-bars">
        <div className="ssrs-item-row-col">
          <PercentStackedBar title={`${item.label} - Frequency`} segments={item.frequency.segments} colors={SCALE_COLORS} />
        </div>
        <div className="ssrs-item-row-col">
          {item.importance ? (
            <PercentStackedBar title={`${item.label} - Importance`} segments={item.importance.segments} colors={SCALE_COLORS} />
          ) : (
            <span className="ssrs-item-row-no-imp">No importance item for this question</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherCompetenceTable({ items }: { items: SsrsTeacherCompetenceItem[] }) {
  if (items.length === 0) {
    return <p className="chart-card-note">No teacher competence items available.</p>;
  }
  const bandLabels = items[0].bands.map((b) => b.label);
  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            {bandLabels.map((label) => (
              <th key={label}>{label}</th>
            ))}
            <th>Valid N</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.item_key}>
              <td>{item.label || item.item_key}</td>
              {item.bands.map((b) => (
                <td key={b.code}>{b.count}</td>
              ))}
              <td>{item.valid_n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Ssrs() {
  const [data, setData] = useState<SsrsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { version } = useRefresh();

  const [ageBand, setAgeBand] = useState("");
  const [sex, setSex] = useState("");
  const [village, setVillage] = useState("");
  const [respondentFilter, setRespondentFilter] = useState("");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");

  const [villageOptions, setVillageOptions] = useState<string[]>([]);
  const [itemTab, setItemTab] = useState<SsrsRespondent>("parent");
  const [sortByVeryOften, setSortByVeryOften] = useState(false);

  useEffect(() => {
    setError(null);
    getSsrs({
      ageBand: ageBand || undefined,
      sex: sex || undefined,
      village: village || undefined,
      respondent: respondentFilter || undefined,
      formDateFrom: formDateFrom || undefined,
      formDateTo: formDateTo || undefined,
    })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [version, retryCount, ageBand, sex, village, respondentFilter, formDateFrom, formDateTo]);

  useEffect(() => {
    getRegistry({ limit: 500 })
      .then((r) => {
        const villages = Array.from(new Set(r.children.map((c) => c.village).filter((v): v is string => Boolean(v)))).sort();
        setVillageOptions(villages);
      })
      .catch(() => setVillageOptions([]));
  }, [version]);

  useEffect(() => {
    if (respondentFilter === "parent" || respondentFilter === "child" || respondentFilter === "teacher") {
      setItemTab(respondentFilter);
    }
  }, [respondentFilter]);

  const sortedItems = useMemo(() => {
    if (!data) return [];
    const items = data.item_responses[itemTab] ?? [];
    if (!sortByVeryOften) return items;
    return [...items].sort((a, b) => b.very_often_percent - a.very_often_percent);
  }, [data, itemTab, sortByVeryOften]);

  const ageBandChartData = useMemo(() => {
    if (!data) return [];
    return data.completion_by_age_band.map((b) => ({
      group: b.band,
      values: { parent: b.parent, child: b.child, teacher: b.teacher },
    }));
  }, [data]);

  const isFiltered = Boolean(ageBand || sex || village || respondentFilter || formDateFrom || formDateTo);
  const resetFilters = () => {
    setAgeBand("");
    setSex("");
    setVillage("");
    setRespondentFilter("");
    setFormDateFrom("");
    setFormDateTo("");
  };

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading SSRS..." />;

  const dateFilterApplies = respondentFilter === "parent" || respondentFilter === "teacher";

  return (
    <section className="ssrs-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="SSRS"
        subtitle="Social Skills Rating System - Parent, Child and Teacher forms, live REDCap data."
      />

      <div className="filter-bar">
        <span className="filter-bar-label">Filter</span>
        <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} aria-label="Age band">
          <option value="">All age bands</option>
          {AGE_BAND_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={sex} onChange={(e) => setSex(e.target.value)} aria-label="Sex">
          <option value="">All sexes</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <select value={village} onChange={(e) => setVillage(e.target.value)} aria-label="Village">
          <option value="">All villages</option>
          {villageOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select value={respondentFilter} onChange={(e) => setRespondentFilter(e.target.value)} aria-label="Respondent">
          <option value="">All respondents</option>
          <option value="parent">Parent / caregiver</option>
          <option value="child">Child</option>
          <option value="teacher">Teacher</option>
        </select>
        <input
          type="date"
          value={formDateFrom}
          onChange={(e) => setFormDateFrom(e.target.value)}
          disabled={!dateFilterApplies}
          aria-label="Form date from"
          title={dateFilterApplies ? "Form date from" : "Select Parent or Teacher respondent to filter by form date"}
        />
        <input
          type="date"
          value={formDateTo}
          onChange={(e) => setFormDateTo(e.target.value)}
          disabled={!dateFilterApplies}
          aria-label="Form date to"
          title={dateFilterApplies ? "Form date to" : "Select Parent or Teacher respondent to filter by form date"}
        />
        <button className="filter-bar-reset" disabled={!isFiltered} onClick={resetFilters}>
          Reset
        </button>
      </div>
      <p className="chart-card-note">
        Age band uses each child&apos;s own registration record (child DOB at visit date). Form date filtering applies only
        to the selected respondent&apos;s own date field (Child has none).
      </p>

      <div className="kpi-row">
        <KpiCard label="Parent Form" value={`${data.parent.completed} / ${STUDY_ORIGINAL_ENROLLMENT}`} sublabel="forms complete · ssrs_parent · 52 items" tone="blue" />
        <KpiCard label="Child Form" value={`${data.child.completed} / ${STUDY_ORIGINAL_ENROLLMENT}`} sublabel="forms complete · ssrs_child · 34 items" tone="violet" />
        <KpiCard label="Teacher Form" value={`${data.teacher.completed} / ${STUDY_ORIGINAL_ENROLLMENT}`} sublabel="forms complete · ssrs_teacher · 42 items + 9 ratings" tone="amber" />
        <KpiCard label="All Three Forms" value={data.all_three_complete_count} sublabel="children with parent, child and teacher forms" tone="aqua" />
      </div>

      <div className="chart-grid two-col">
        <ChartCard title="Completion by Age Band" subtitle="Parent, Child and Teacher form completion, grouped by the child's age band">
          {ageBandChartData.length > 0 ? (
            <GroupedBarChart
              data={ageBandChartData}
              series={[
                { key: "parent", label: "Parent" },
                { key: "child", label: "Child" },
                { key: "teacher", label: "Teacher" },
              ]}
            />
          ) : (
            <p className="chart-card-note">No age-band data available yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Data Quality Checks" subtitle="Automated checks only - not confirmed data-entry errors">
          <div className="table-card">
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Child ID not found in registration</td>
                  <td>{data.data_quality.child_id_not_found_count}</td>
                </tr>
                <tr>
                  <td>Form date missing (completed forms only)</td>
                  <td>{data.data_quality.form_date_missing_count}</td>
                </tr>
                <tr>
                  <td>Required items left blank (completed forms only)</td>
                  <td>{data.data_quality.required_items_blank_count}</td>
                </tr>
                <tr>
                  <td>Items with a comment, for qualitative review</td>
                  <td>{data.data_quality.items_with_comment_count}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="chart-card-note">
            Comment text itself is never shown here - only whether an item has one. The Child form has no ID or date
            field of its own; it is linked only through the shared REDCap record.
          </p>
        </ChartCard>
      </div>

      <SectionHeader title="Item Responses: Frequency and Importance" note="A blank answer is excluded from the distribution, never counted as 0" />
      <div className="ssrs-respondent-tabs">
        {RESPONDENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`ssrs-respondent-tab${itemTab === tab.key ? " ssrs-respondent-tab-active" : ""}`}
            onClick={() => setItemTab(tab.key)}
          >
            {tab.label} ({data.item_responses[tab.key]?.length ?? 0} items)
          </button>
        ))}
        <button type="button" className="filter-bar-reset" onClick={() => setSortByVeryOften((v) => !v)}>
          {sortByVeryOften ? "Sorted by Very Often share ✓" : "Sort by Very Often share"}
        </button>
      </div>
      <div className="ssrs-scale-legends">
        <div>
          <span className="ssrs-scale-legend-label">Frequency</span>
          <ScaleLegend segments={[{ code: "0", label: "Never" }, { code: "1", label: "Sometimes" }, { code: "2", label: "Very Often" }]} />
        </div>
        <div>
          <span className="ssrs-scale-legend-label">Importance</span>
          <ScaleLegend segments={[{ code: "0", label: "Not Important" }, { code: "1", label: "Important" }, { code: "2", label: "Critical" }]} />
        </div>
      </div>
      <div className="ssrs-item-list">
        {sortedItems.length > 0 ? (
          sortedItems.map((item) => <ItemResponseRow key={item.item_key} item={item} />)
        ) : (
          <p className="chart-card-note">No item responses available for this respondent yet.</p>
        )}
      </div>

      <SectionHeader title="Teacher Academic Competence" note="Scale 1-5 as defined in the dictionary - count of children per band" />
      <TeacherCompetenceTable items={data.teacher_competence} />

      <SectionHeader title="Domain Scores and Respondent Agreement" />
      <div className="ssrs-pending-tile">
        <IconClipboardAlert width={22} height={22} />
        <div>
          <div className="ssrs-pending-title">Pending scoring key</div>
          <p>
            The data dictionary has no calculated fields and no item-to-domain mapping, so only item-level results can be
            shown today.
          </p>
          <p>
            <strong>Needed:</strong> the SSRS scoring key - which items form each domain, any reverse-scored items, and how
            a total is calculated.
          </p>
          <p>Once supplied, a domain score card per respondent and parent/child/teacher agreement will appear here automatically.</p>
        </div>
      </div>

      <DetailDisclosure summary="Field reference">
        <p className="chart-card-note">
          Parent: parent_child_id, parent_date, p1..p52 (p1_freq/p1_imp/p1_comment, etc. - only p1-p40 have an importance
          item). Child: c1..c34 (no ID/date field of its own). Teacher: teacher_child_id, teacher_date, t1..t42, plus
          t43_rating..t51_rating (academic competence, 5-level scale). Completion fields:
          ssrs_parent_complete/ssrs_child_complete/ssrs_teacher_complete (2 = Complete).
        </p>
      </DetailDisclosure>
    </section>
  );
}
