import { useEffect, useMemo, useState } from "react";

import { getRegistry, getSsrs, getSsrsChildDetail } from "../api/dashboard";
import ChartCard from "../components/ChartCard";
import DataLoadError from "../components/DataLoadError";
import DetailDisclosure from "../components/DetailDisclosure";
import FullScreenLoader from "../components/FullScreenLoader";
import CategoryBarChart from "../components/CategoryBarChart";
import CorrelationScatter from "../components/charts/CorrelationScatter";
import GroupedBarChart from "../components/charts/GroupedBarChart";
import { IconChevron } from "../components/icons";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import PercentStackedBar from "../components/PercentStackedBar";
import ProportionBar from "../components/ProportionBar";
import SectionHeader from "../components/SectionHeader";
import { useRefresh } from "../context/RefreshContext";
import { STUDY_ORIGINAL_ENROLLMENT } from "../lib/studyCohort";
import type {
  SsrsChildDetailResponse,
  SsrsChildScoreCell,
  SsrsChildScoreRow,
  SsrsCompare,
  SsrsDomainKey,
  SsrsItemResponse,
  SsrsRespondent,
  SsrsResponse,
  SsrsTeacherCompetenceItem,
} from "../types/liveDashboard";

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

const DOMAIN_KEYS_BY_RESPONDENT: Record<SsrsRespondent, SsrsDomainKey[]> = {
  parent: ["social_skills", "problem_behaviours"],
  child: ["social_skills"],
  teacher: ["social_skills", "problem_behaviours", "academic_competence"],
};

const ITEM_RANGE_TEXT: Record<string, string> = {
  "parent:social_skills": "p1_freq–p40_freq",
  "parent:problem_behaviours": "p41_freq–p52_freq",
  "child:social_skills": "c1_freq–c34_freq",
  "teacher:social_skills": "t1_freq–t30_freq",
  "teacher:problem_behaviours": "t31_freq–t42_freq",
  "teacher:academic_competence": "t43_rating–t51_rating",
};

const COMPARE_OPTIONS: { key: SsrsCompare; label: string }[] = [
  { key: "parent_vs_teacher", label: "Parent vs Teacher" },
  { key: "parent_vs_child", label: "Parent vs Child" },
  { key: "teacher_vs_child", label: "Teacher vs Child" },
];

function fmt(value: number | null, digits = 1): string {
  return value === null ? "–" : value.toFixed(digits);
}

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

  const [scoreRespondent, setScoreRespondent] = useState<SsrsRespondent>("parent");
  const [compareKey, setCompareKey] = useState<SsrsCompare>("parent_vs_teacher");

  const [childSearch, setChildSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("child_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [childDetails, setChildDetails] = useState<Record<string, SsrsChildDetailResponse | "loading" | "error">>({});

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

  // Reset the child-detail cache whenever the underlying SSRS data changes
  // (a refresh, or a filter narrowing the cohort) - a cached answer set
  // could otherwise go stale silently.
  useEffect(() => {
    setChildDetails({});
    setExpandedChild(null);
  }, [version, ageBand, sex, village, respondentFilter, formDateFrom, formDateTo]);

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

  const meanByAgeSexChartData = useMemo(() => {
    if (!data) return [];
    return (data.mean_by_age_sex[scoreRespondent] ?? []).map((row) => ({
      group: row.band,
      values: { male: row.male_mean, female: row.female_mean },
      validN: { male: row.male_n, female: row.female_n },
    }));
  }, [data, scoreRespondent]);

  const sortedChildRows = useMemo(() => {
    if (!data) return [];
    let rows = data.child_scores;
    if (childSearch.trim()) {
      const q = childSearch.trim().toLowerCase();
      rows = rows.filter((r) => r.child_id.toLowerCase().includes(q));
    }
    const cellValue = (cell: SsrsChildScoreCell) => (cell.status === "scored" && cell.score !== null ? cell.score : -1);
    const columnValue = (row: SsrsChildScoreRow): string | number => {
      switch (sortCol) {
        case "age_band":
          return row.age_band;
        case "sex":
          return row.sex;
        case "parent_social":
        case "parent_problem":
        case "child_social":
        case "teacher_social":
        case "teacher_problem":
        case "teacher_academic":
          return cellValue(row[sortCol as keyof SsrsChildScoreRow] as SsrsChildScoreCell);
        default:
          return row.child_id;
      }
    };
    const sorted = [...rows].sort((a, b) => {
      const va = columnValue(a);
      const vb = columnValue(b);
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [data, childSearch, sortCol, sortDir]);

  const isFiltered = Boolean(ageBand || sex || village || respondentFilter || formDateFrom || formDateTo);
  const resetFilters = () => {
    setAgeBand("");
    setSex("");
    setVillage("");
    setRespondentFilter("");
    setFormDateFrom("");
    setFormDateTo("");
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const toggleChildRow = (childId: string) => {
    if (expandedChild === childId) {
      setExpandedChild(null);
      return;
    }
    setExpandedChild(childId);
    if (!childDetails[childId]) {
      setChildDetails((prev) => ({ ...prev, [childId]: "loading" }));
      getSsrsChildDetail(childId)
        .then((detail) => setChildDetails((prev) => ({ ...prev, [childId]: detail })))
        .catch(() => setChildDetails((prev) => ({ ...prev, [childId]: "error" })));
    }
  };

  if (error) return <DataLoadError message={error} onRetry={() => setRetryCount((c) => c + 1)} />;
  if (!data) return <FullScreenLoader message="Loading SSRS..." />;

  const dateFilterApplies = respondentFilter === "parent" || respondentFilter === "teacher";
  const domainKeys = DOMAIN_KEYS_BY_RESPONDENT[scoreRespondent];
  const compareResult = data.agreement[compareKey];
  const compareLabels: Record<SsrsCompare, { x: string; y: string }> = {
    parent_vs_teacher: { x: "Parent score, % of maximum (80)", y: "Teacher score, % of maximum (60)" },
    parent_vs_child: { x: "Parent score, % of maximum (80)", y: "Child score, % of maximum (68)" },
    teacher_vs_child: { x: "Teacher score, % of maximum (60)", y: "Child score, % of maximum (68)" },
  };

  return (
    <section className="ssrs-page">
      <PageHeader
        eyebrow="Study Assessment"
        title="SSRS"
        subtitle="Social Skills Rating System - Parent, Child and Teacher forms, live REDCap data."
      />
      <p className="chart-card-note">
        Adapted, SSRS-informed research questionnaire - raw scores only. No official norms, cutoffs, percentiles or
        &quot;at risk&quot; labels are shown anywhere on this page.
      </p>

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

      <SectionHeader
        title="Scores: Raw Domain Totals"
        note="Raw sums of the frequency answers only - importance is never scored, and no item is reverse-scored."
      />
      <div className="ssrs-respondent-tabs">
        {RESPONDENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`ssrs-respondent-tab${scoreRespondent === tab.key ? " ssrs-respondent-tab-active" : ""}`}
            onClick={() => setScoreRespondent(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`ssrs-domain-grid ssrs-domain-grid-${domainKeys.length}`}>
        {domainKeys.map((key) => {
          const summary = data.scores[scoreRespondent]?.[key];
          if (!summary) return null;
          return (
            <div className="ssrs-domain-card" key={key}>
              <div className="ssrs-domain-card-title">
                {summary.domain} <span className="ssrs-domain-card-range-label">items {ITEM_RANGE_TEXT[`${scoreRespondent}:${key}`]}</span>
              </div>
              <div className="ssrs-domain-stat-row">
                <div className="ssrs-domain-stat">
                  <span className="ssrs-domain-stat-label">Mean (SD)</span>
                  <span className="ssrs-domain-stat-value">
                    {fmt(summary.mean)} ({fmt(summary.std_dev)})
                  </span>
                </div>
                <div className="ssrs-domain-stat">
                  <span className="ssrs-domain-stat-label">Median (IQR)</span>
                  <span className="ssrs-domain-stat-value">
                    {fmt(summary.median, 0)} ({fmt(summary.q1, 0)}
                    {"–"}
                    {fmt(summary.q3, 0)})
                  </span>
                </div>
              </div>
              <ProportionBar value={summary.mean ?? 0} total={summary.maximum} />
              <div className="ssrs-domain-range-row">
                <span>{summary.minimum}</span>
                <span className="ssrs-domain-range-mid">possible range</span>
                <span>{summary.maximum}</span>
              </div>
              <div className="ssrs-domain-card-footer">
                {summary.n_scored} scored / {summary.n_forms} forms · <strong>{summary.direction}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="chart-grid two-col">
        {domainKeys.map((key) => {
          const summary = data.scores[scoreRespondent]?.[key];
          if (!summary) return null;
          return (
            <ChartCard key={key} title={`Distribution: ${summary.domain} (children per score)`} subtitle={`n scored = ${summary.n_scored}`}>
              {summary.histogram.length > 0 ? (
                <CategoryBarChart data={summary.histogram} mode="sequential" height={180} xTickMaxChars={8} />
              ) : (
                <p className="chart-card-note">No scored forms yet for this domain.</p>
              )}
            </ChartCard>
          );
        })}
      </div>

      <div className="chart-grid two-col">
        <ChartCard
          title={`Mean Social Skills Score by Age Group and Sex (${RESPONDENT_TABS.find((t) => t.key === scoreRespondent)?.label})`}
          subtitle="Scored children only - n shown per bar in the tooltip"
        >
          {meanByAgeSexChartData.length > 0 ? (
            <GroupedBarChart
              data={meanByAgeSexChartData}
              series={[
                { key: "male", label: "Male" },
                { key: "female", label: "Female" },
              ]}
            />
          ) : (
            <p className="chart-card-note">No scored Social Skills forms yet for this respondent.</p>
          )}
        </ChartCard>

        <ChartCard title="Respondent Agreement: Social Skills, % of Maximum" subtitle="Children scored by both respondents only">
          <div className="ssrs-compare-row">
            <span className="filter-bar-label">Compare</span>
            <select value={compareKey} onChange={(e) => setCompareKey(e.target.value as SsrsCompare)} aria-label="Compare respondents">
              {COMPARE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {compareResult.n >= 3 ? (
            <>
              <p className="chart-card-note">
                n={compareResult.n} · correlation {compareResult.correlation === null ? "undetermined" : compareResult.correlation.toFixed(3)}
              </p>
              <CorrelationScatter data={compareResult.points} xLabel={compareLabels[compareKey].x} yLabel={compareLabels[compareKey].y} />
            </>
          ) : (
            <p className="chart-card-note">
              Need at least 3 children scored by both respondents to draw this comparison (currently n={compareResult.n}).
            </p>
          )}
        </ChartCard>
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
                  <td>Domains not scored because items are unanswered</td>
                  <td>{data.data_quality.domains_not_scored_count}</td>
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

      <SectionHeader title="Child-Level Scores" note="Sortable by any column. Selecting a child opens their item-level answers. No names, no comments are ever shown." />
      <input
        type="text"
        className="ssrs-child-search"
        placeholder="Search Child ID"
        value={childSearch}
        onChange={(e) => setChildSearch(e.target.value)}
        aria-label="Search Child ID"
      />
      <div className="table-card ssrs-child-table-card">
        <table className="data-table ssrs-child-table">
          <thead>
            <tr>
              {[
                { key: "child_id", label: "Child ID" },
                { key: "age_band", label: "Age Group" },
                { key: "sex", label: "Sex" },
                { key: "parent_social", label: "Parent: Social" },
                { key: "parent_problem", label: "Parent: Problem" },
                { key: "child_social", label: "Child: Social" },
                { key: "teacher_social", label: "Teacher: Social" },
                { key: "teacher_problem", label: "Teacher: Problem" },
                { key: "teacher_academic", label: "Teacher: Academic" },
              ].map((col) => (
                <th key={col.key}>
                  <button type="button" className="ssrs-sort-th" onClick={() => handleSort(col.key)}>
                    {col.label}
                    {sortCol === col.key && (
                      <IconChevron width={11} height={11} style={{ transform: sortDir === "asc" ? "rotate(90deg)" : "rotate(-90deg)" }} />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedChildRows.map((row) => (
              <ChildScoreRows
                key={row.child_id}
                row={row}
                expanded={expandedChild === row.child_id}
                detail={childDetails[row.child_id]}
                onToggle={() => toggleChildRow(row.child_id)}
              />
            ))}
          </tbody>
        </table>
        {sortedChildRows.length === 0 && <p className="chart-card-note">No children match this search.</p>}
      </div>

      <SectionHeader title="Item Detail" />
      <DetailDisclosure summary="Item detail: frequency and importance (drill-down)">
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
        <p className="chart-card-note">A blank answer is excluded from the distribution, never counted as 0.</p>
        <div className="ssrs-item-list">
          {sortedItems.length > 0 ? (
            sortedItems.map((item) => <ItemResponseRow key={item.item_key} item={item} />)
          ) : (
            <p className="chart-card-note">No item responses available for this respondent yet.</p>
          )}
        </div>
      </DetailDisclosure>

      <SectionHeader title="Teacher Academic Competence" note="Scale 1-5 as defined in the dictionary - count of children per band" />
      <TeacherCompetenceTable items={data.teacher_competence} />

      <SectionHeader title="How Each Score Is Calculated" />
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Respondent</th>
              <th>Domain</th>
              <th>Items</th>
              <th>Range</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            {RESPONDENT_TABS.flatMap((tab) =>
              DOMAIN_KEYS_BY_RESPONDENT[tab.key].map((key) => {
                const summary = data.scores[tab.key]?.[key];
                if (!summary) return null;
                return (
                  <tr key={`${tab.key}-${key}`}>
                    <td>{tab.label}</td>
                    <td>{summary.domain}</td>
                    <td>{ITEM_RANGE_TEXT[`${tab.key}:${key}`]}</td>
                    <td>
                      {summary.minimum}
                      {"–"}
                      {summary.maximum}
                    </td>
                    <td>{summary.direction}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p className="chart-card-note">
        Score = sum of the frequency answers (0, 1, 2) for the domain&apos;s items. Academic ratings (t43_rating..t51_rating)
        are summed as 1-5. Importance is never scored. No item is reverse-scored. A domain is scored only when its form
        is marked Complete and every item in the domain is answered - otherwise it is reported as not scored, and a
        partial form is never summed nor is a blank ever counted as 0.
      </p>
      <p className="chart-card-note">
        <strong>Raw scores only.</strong> This is an adapted, SSRS-informed research questionnaire, not the official
        SSRS: no official norms, cutoffs, percentiles or &quot;at risk&quot; labels.
      </p>

      <DetailDisclosure summary="Field reference">
        <p className="chart-card-note">
          Parent: parent_child_id, parent_date, p1..p52 (p1_freq/p1_imp/p1_comment, etc. - only p1-p40 have an importance
          item). Child: c1..c34 (no ID/date field of its own). Teacher: teacher_child_id, teacher_date, t1..t42, plus
          t43_rating..t51_rating (academic competence, 5-level scale, 9 items). Completion fields:
          ssrs_parent_complete/ssrs_child_complete/ssrs_teacher_complete (2 = Complete).
        </p>
      </DetailDisclosure>
    </section>
  );
}

function cellText(cell: SsrsChildScoreCell): string {
  if (cell.status === "scored") return String(cell.score);
  if (cell.status === "not_scored") return `Not scored: ${cell.answered} of ${cell.total} answered`;
  return "No form yet";
}

function ChildScoreRows({
  row,
  expanded,
  detail,
  onToggle,
}: {
  row: SsrsChildScoreRow;
  expanded: boolean;
  detail: SsrsChildDetailResponse | "loading" | "error" | undefined;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="ssrs-child-row" onClick={onToggle}>
        <td>
          <button type="button" className="ssrs-child-row-toggle">
            <IconChevron width={11} height={11} style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} />
            {row.child_id}
          </button>
        </td>
        <td>{row.age_band}</td>
        <td>{row.sex || "–"}</td>
        <td className={row.parent_social.status !== "scored" ? "ssrs-cell-muted" : undefined}>{cellText(row.parent_social)}</td>
        <td className={row.parent_problem.status !== "scored" ? "ssrs-cell-muted" : undefined}>{cellText(row.parent_problem)}</td>
        <td className={row.child_social.status !== "scored" ? "ssrs-cell-muted" : undefined}>{cellText(row.child_social)}</td>
        <td className={row.teacher_social.status !== "scored" ? "ssrs-cell-muted" : undefined}>{cellText(row.teacher_social)}</td>
        <td className={row.teacher_problem.status !== "scored" ? "ssrs-cell-muted" : undefined}>{cellText(row.teacher_problem)}</td>
        <td className={row.teacher_academic.status !== "scored" ? "ssrs-cell-muted" : undefined}>{cellText(row.teacher_academic)}</td>
      </tr>
      {expanded && (
        <tr className="ssrs-child-detail-row">
          <td colSpan={9}>
            <ChildItemDetail detail={detail} />
          </td>
        </tr>
      )}
    </>
  );
}

function ChildItemDetail({ detail }: { detail: SsrsChildDetailResponse | "loading" | "error" | undefined }) {
  if (!detail || detail === "loading") return <p className="chart-card-note">Loading item-level answers...</p>;
  if (detail === "error") return <p className="chart-card-note">Could not load this child&apos;s item-level answers.</p>;
  const respondents: { key: SsrsRespondent; label: string }[] = [
    { key: "parent", label: "Parent" },
    { key: "child", label: "Child" },
    { key: "teacher", label: "Teacher" },
  ];
  return (
    <div className="ssrs-child-detail-panels">
      {respondents.map(({ key, label }) => {
        const respondentDetail = detail[key];
        const hasAny = respondentDetail.items.length > 0 || respondentDetail.ratings.length > 0;
        return (
          <div className="ssrs-child-detail-panel" key={key}>
            <div className="ssrs-child-detail-panel-title">{label}</div>
            {!hasAny && <p className="chart-card-note">No answers recorded for this respondent.</p>}
            {respondentDetail.items.length > 0 && (
              <table className="data-table ssrs-child-detail-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Frequency</th>
                    <th>Importance</th>
                  </tr>
                </thead>
                <tbody>
                  {respondentDetail.items.map((item) => (
                    <tr key={item.item_key}>
                      <td>{item.label || item.item_key}</td>
                      <td>{item.frequency ?? "–"}</td>
                      <td>{item.importance ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {respondentDetail.ratings.length > 0 && (
              <table className="data-table ssrs-child-detail-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {respondentDetail.ratings.map((rating) => (
                    <tr key={rating.item_key}>
                      <td>{rating.label || rating.item_key}</td>
                      <td>{rating.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
