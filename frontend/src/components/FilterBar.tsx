import type { PopulationFilters } from "../lib/populationAnalytics";

interface FilterBarProps {
  filters: PopulationFilters;
  onChange: (filters: PopulationFilters) => void;
  villageOptions: string[];
}

const AGE_GROUP_OPTIONS = ["8 years", "9 years", "10 years", "Other (outside 8-10 years)"];

export default function FilterBar({ filters, onChange, villageOptions }: FilterBarProps) {
  const hasActiveFilter = Boolean(filters.sex || filters.ageGroup || filters.village || filters.status);

  return (
    <div className="filter-bar">
      <span className="filter-bar-label">Filter</span>
      <select
        value={filters.sex ?? ""}
        onChange={(e) => onChange({ ...filters, sex: e.target.value || undefined })}
      >
        <option value="">All sexes</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>
      <select
        value={filters.ageGroup ?? ""}
        onChange={(e) => onChange({ ...filters, ageGroup: e.target.value || undefined })}
      >
        <option value="">All ages</option>
        {AGE_GROUP_OPTIONS.map((group) => (
          <option key={group} value={group}>
            {group} yrs
          </option>
        ))}
      </select>
      <select
        value={filters.village ?? ""}
        onChange={(e) => onChange({ ...filters, village: e.target.value || undefined })}
      >
        <option value="">All villages</option>
        {villageOptions.map((village) => (
          <option key={village} value={village}>
            {village}
          </option>
        ))}
      </select>
      <select
        value={filters.status ?? ""}
        onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
      >
        <option value="">All registration statuses</option>
        <option value="Complete">Registration complete</option>
        <option value="Incomplete">Registration incomplete</option>
      </select>
      <button className="filter-bar-reset" disabled={!hasActiveFilter} onClick={() => onChange({})}>
        Reset
      </button>
    </div>
  );
}
