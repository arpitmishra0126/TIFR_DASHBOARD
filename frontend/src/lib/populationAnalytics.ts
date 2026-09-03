import type { RegistryChild } from "../types/liveDashboard";

export interface CategoryDatum {
  label: string;
  count: number;
}

// Study-specific age groups (the cohort's target ages), replacing the
// previous broad 0-4/5-9/10-14/15+ bands. A registered child whose computed
// age falls outside 8-10 is shown as "Other" rather than silently dropped,
// for data-integrity visibility.
const AGE_BUCKETS: [string, number, number][] = [
  ["8 years", 8, 8],
  ["9 years", 9, 9],
  ["10 years", 10, 10],
];

export function ageBucketLabel(ageYears: number | null): string {
  if (ageYears === null) return "Unknown";
  const bucket = AGE_BUCKETS.find(([, low, high]) => ageYears >= low && ageYears <= high);
  return bucket ? bucket[0] : "Other (outside 8-10 years)";
}

export interface PopulationFilters {
  sex?: string;
  ageGroup?: string;
  village?: string;
  status?: string;
}

export function applyFilters(children: RegistryChild[], filters: PopulationFilters): RegistryChild[] {
  return children.filter((child) => {
    if (filters.sex && child.sex !== filters.sex) return false;
    if (filters.ageGroup && ageBucketLabel(child.age_years) !== filters.ageGroup) return false;
    if (filters.village && child.village !== filters.village) return false;
    if (filters.status) {
      const isComplete = child.registration_complete;
      if (filters.status === "Complete" && !isComplete) return false;
      if (filters.status === "Incomplete" && isComplete) return false;
    }
    return true;
  });
}

export function sexDistribution(children: RegistryChild[]): CategoryDatum[] {
  const counts = { Male: 0, Female: 0, Unknown: 0 };
  for (const c of children) {
    if (c.sex === "Male") counts.Male += 1;
    else if (c.sex === "Female") counts.Female += 1;
    else counts.Unknown += 1;
  }
  return [
    { label: "Male", count: counts.Male },
    { label: "Female", count: counts.Female },
    { label: "Unknown", count: counts.Unknown },
  ];
}

export function ageDistribution(children: RegistryChild[]): CategoryDatum[] {
  const counts = new Map<string, number>(AGE_BUCKETS.map(([label]) => [label, 0]));
  let other = 0;
  let unknown = 0;
  for (const c of children) {
    const label = ageBucketLabel(c.age_years);
    if (label === "Unknown") {
      unknown += 1;
    } else if (label === "Other (outside 8-10 years)") {
      other += 1;
    } else {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const result = AGE_BUCKETS.map(([label]) => ({ label, count: counts.get(label) ?? 0 }));
  if (other) result.push({ label: "Other (outside 8-10 years)", count: other });
  if (unknown) result.push({ label: "Unknown", count: unknown });
  return result;
}

export function villageDistribution(children: RegistryChild[], topN = 8): CategoryDatum[] {
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const c of children) {
    if (!c.village) {
      unknown += 1;
      continue;
    }
    counts.set(c.village, (counts.get(c.village) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN).map(([label, count]) => ({ label, count }));
  const rest = sorted.slice(topN).reduce((sum, [, count]) => sum + count, 0);
  if (rest > 0) top.push({ label: "Other villages", count: rest });
  if (unknown) top.push({ label: "Unknown", count: unknown });
  return top;
}

export function distinctVillages(children: RegistryChild[]): string[] {
  const set = new Set<string>();
  for (const c of children) {
    if (c.village) set.add(c.village);
  }
  return [...set].sort();
}
