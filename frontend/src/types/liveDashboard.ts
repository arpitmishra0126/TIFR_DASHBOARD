/**
 * Types for the live REDCap-backed /api/v1/dashboard/* endpoints
 * (backend/app/schemas/dashboard.py). This is the V1 dashboard's actual
 * data contract — REDCap is the source of truth, there is no database.
 */

export interface SexDistribution {
  male: number;
  female: number;
  unknown: number;
}

export interface AgeBucket {
  label: string;
  count: number;
}

export interface CategoryCount {
  code: string;
  count: number;
}

export interface NumericSummary {
  count: number;
  mean: number;
  minimum: number;
  maximum: number;
}

export interface UnavailableModule {
  available: false;
  reason: string;
  unavailable_fields: string[];
}

export interface InstrumentCoverage {
  key: string;
  label: string;
  completed_count: number;
  percent_of_registered: number;
}

export interface OverviewResponse {
  total_registered: number;
  registration_complete_count: number;
  registration_complete_percent: number;
  core_assessment_count: number;
  core_assessment_percent: number;
  ssrs_child_count: number;
  ssrs_child_percent: number;
  ssrs_teacher_count: number;
  ssrs_teacher_percent: number;
  instrument_coverage: InstrumentCoverage[];
  sex_distribution: SexDistribution;
  age_distribution: AgeBucket[];
  udai_pareek_category_distribution: CategoryCount[];
  modules_pending_integration: string[];
  notes: Record<string, string>;
}

export interface RegistryChild {
  redcap_child_id: string;
  sex: string | null;
  dob: string | null;
  age_years: number | null;
  village: string | null;
  child_status: string | null;
  visit_date: string | null;
  registration_complete: boolean;
}

export interface RegistryResponse {
  total: number;
  limit: number;
  offset: number;
  children: RegistryChild[];
  unavailable_fields: string[];
}

export interface DemographicsResponse {
  sex_distribution: SexDistribution;
  age_distribution: AgeBucket[];
  udai_pareek_category_distribution: CategoryCount[];
  bg_prasad_category_distribution: CategoryCount[];
  per_capita_income_summary: NumericSummary | null;
  household_size_summary: NumericSummary | null;
  ses_profile_count: number;
  total_registered: number;
  notes: Record<string, string>;
}

// --- Assessment module analytics (Health & Screening / Physical Activity /
// Screen Time / Neurodevelopment) — approved 2026-08-26 analytical
// specification. Population = all registered children. ---
export interface InstrumentCompletion {
  instrument: string;
  completed: number;
  total_registered: number;
  percent: number;
  coverage_tier: "High" | "Partial" | "No Data";
}

export interface ScoreSummary {
  valid_n: number;
  missing_n: number;
  total: number;
  percent_valid: number;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
}

export interface HealthScreeningResponse {
  instrument: string;
  completion: InstrumentCompletion;
  named_conditions: CategoryCount[];
  general_flags: CategoryCount[];
  notes: Record<string, string>;
}

export interface PhysicalActivityResponse {
  instrument: string;
  completion: InstrumentCompletion;
  item1_summary: ScoreSummary;
  item8_summary: ScoreSummary;
  total_summary: ScoreSummary;
  total_score_distribution: CategoryCount[];
  notes: Record<string, string>;
}

export interface ScreenTimeResponse {
  instrument: string;
  completion: InstrumentCompletion;
  total_screen_time_distribution: CategoryCount[];
  yes_no_items: CategoryCount[];
  notes: Record<string, string>;
}

export interface SSRSInstrumentSummary {
  instrument: string;
  children_with_any_data: number;
  total_registered: number;
  percent: number;
  completed_count: number;
  avg_frequency_summary: ScoreSummary;
  avg_importance_summary: ScoreSummary;
}

export interface NeurodevelopmentResponse {
  parent: SSRSInstrumentSummary;
  child: SSRSInstrumentSummary;
  teacher: SSRSInstrumentSummary;
  notes: Record<string, string>;
}

export interface ProgressStage {
  key: string;
  label: string;
  description: string;
  count: number;
  percent_of_registered: number;
  percent_of_previous_stage: number | null;
}

export interface ProgressResponse {
  total_registered: number;
  stages: ProgressStage[];
}
