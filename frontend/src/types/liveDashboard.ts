/**
 * Types for the live REDCap-backed /api/v1/dashboard/* endpoints
 * (backend/app/schemas/dashboard.py). This is the V1 dashboard's actual
 * data contract - REDCap is the source of truth, there is no database.
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

export type CoverageTier = "High" | "Partial" | "No Data";

export interface InstrumentCoverage {
  key: string;
  label: string;
  completed_count: number;
  percent_of_registered: number;
  coverage_tier: CoverageTier;
}

export interface ConditionIndicator {
  label: string;
  yes_count: number;
  no_count: number;
  dont_know_count: number;
  valid_n: number;
  asked_n: number;
  missing_count: number;
  percent_yes: number;
}

export interface OverviewResponse {
  total_registered: number;
  registration_complete_count: number;
  registration_complete_percent: number;
  core_assessment_count: number;
  core_assessment_percent: number;
  ssrs_parent_count: number;
  ssrs_parent_percent: number;
  ssrs_child_count: number;
  ssrs_child_percent: number;
  ssrs_teacher_count: number;
  ssrs_teacher_percent: number;
  instrument_coverage: InstrumentCoverage[];
  all_instrument_coverage: InstrumentCoverage[];
  sex_distribution: SexDistribution;
  age_distribution: AgeBucket[];
  udai_pareek_category_distribution: CategoryCount[];
  chh_completion: InstrumentCompletion;
  chh_named_conditions: ConditionIndicator[];
  chh_general_flags: ConditionIndicator[];
  dseq_completion: InstrumentCompletion;
  dseq_screen_time_distribution: CategoryCount[];
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
  instrument_status: Record<string, boolean>;
  // Assessment Tool Status (2026-09-11) - one of "done" / "not_done" /
  // "not_answered" for each of the four separate tests, keyed by
  // "sangian" / "vwm" / "dccs" / "cd". A status label only - no score or
  // denominator.
  assessment_tool_status_detail: Record<string, string>;
  core_battery_complete: boolean;
  progression_stage: "Registered" | "Core Assessment Battery" | "SSRS Child" | "SSRS Teacher";
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
// Screen Time / Neurodevelopment) - approved 2026-08-26 analytical
// specification. Population = all registered children. ---
export interface InstrumentCompletion {
  instrument: string;
  completed: number;
  total_registered: number;
  percent: number;
  coverage_tier: CoverageTier;
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
  named_conditions: ConditionIndicator[];
  general_flags: ConditionIndicator[];
  notes: Record<string, string>;
}

export interface ScoredItemSummary {
  key: string;
  label: string;
  valid_n: number;
  missing_n: number;
  total: number;
  percent_valid: number;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
}

export interface WeeklyActivityDay {
  day: string;
  valid_n: number;
  missing_n: number;
  total: number;
  percent_valid: number;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
}

export interface PhysicalActivityResponse {
  instrument: string;
  completion: InstrumentCompletion;
  item1_summary: ScoreSummary;
  item8_summary: ScoreSummary;
  total_summary: ScoreSummary;
  total_score_distribution: CategoryCount[];
  item_scores: ScoredItemSummary[];
  weekly_activity: WeeklyActivityDay[];
  item10_exclusion: ConditionIndicator;
  notes: Record<string, string>;
}

export interface MinutesSummary {
  valid_n: number;
  missing_n: number;
  total: number;
  percent_valid: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
}

export interface PairedMinutesPoint {
  group: string;
  mean: number | null;
  median: number | null;
  valid_n: number;
}

export interface GroupedMinutesPoint {
  group: string;
  mean: number | null;
  valid_n: number;
}

export interface DeviceMinutes {
  device: string;
  mean_minutes: number | null;
  valid_n: number;
}

export interface ScreenActivityPoint {
  screen_minutes: number;
  activity_minutes: number;
}

export interface DseqCodingScores {
  frequency: ScoreSummary;
  duration: ScoreSummary;
  supervision: ScoreSummary;
  household_rules: ScoreSummary;
}

export interface ScreenTimeResponse {
  instrument: string;
  completion: InstrumentCompletion;
  missing_count: number;
  missing_percent: number;
  coding_scores: DseqCodingScores;

  average_daily_summary: MinutesSummary;
  school_day_summary: MinutesSummary;
  weekend_summary: MinutesSummary;
  difference_summary: MinutesSummary;
  school_vs_weekend: PairedMinutesPoint[];
  screen_time_distribution_minutes: CategoryCount[];
  difference_distribution: CategoryCount[];
  by_age: GroupedMinutesPoint[];
  by_sex: GroupedMinutesPoint[];
  by_device: DeviceMinutes[];

  purpose_distribution: CategoryCount[];
  supervision_distribution: CategoryCount[];
  household_rules_distribution: CategoryCount[];
  household_rules_valid_n: number;

  physical_activity_school_day_summary: MinutesSummary;
  physical_activity_weekend_summary: MinutesSummary;
  physical_activity_school_vs_weekend: PairedMinutesPoint[];
  screen_vs_activity_scatter: ScreenActivityPoint[];

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

export interface DietaryFoodItem {
  field_label: string;
  distribution: CategoryCount[];
  valid_n: number;
  missing_n: number;
  percent_valid: number;
}

export interface OtherFoodEntry {
  food_name: string;
  portion: string | null;
  portion_status: "recorded" | "not_applicable" | "not_answered";
  frequency: string | null;
  frequency_status: "recorded" | "not_answered";
}

export interface OtherFoodSpecifiedSummary {
  valid_n: number;
  total: number;
  percent_valid: number;
  entries: OtherFoodEntry[];
}

export interface DietaryIntakeResponse {
  instrument: string;
  completion: InstrumentCompletion;
  items: DietaryFoodItem[];
  other_food_specified: OtherFoodSpecifiedSummary;
  notes: Record<string, string>;
}

export interface AssessmentToolItemStatus {
  key: string;
  label: string;
  done_count: number;
  not_done_count: number;
  valid_n: number;
  completion_percent: number;
}

export interface AssessmentDomainStatus {
  field_count: number;
  valid_n: number;
  missing_n: number;
  total: number;
  percent_valid: number;
  mean_done: number | null;
  completion_percent: number | null;
}

export interface AssessmentPooledStatus {
  done_count: number;
  not_done_count: number;
  valid_n: number;
  completion_percent: number;
}

export interface AssessmentParticipantStatus {
  done_count: number;
  total: number;
  percent: number;
}

export interface AssessmentToolParticipantStatus {
  child_id: string;
  sangian: boolean;
  vwm: boolean;
  dccs: boolean;
  cd: boolean;
}

export interface AssessmentToolStatusResponse {
  instrument: string;
  completion: InstrumentCompletion;
  sangian: AssessmentDomainStatus;
  vwm: AssessmentDomainStatus;
  overall: AssessmentDomainStatus;
  overall_pooled: AssessmentPooledStatus;
  items: AssessmentToolItemStatus[];
  sangian_participant: AssessmentParticipantStatus;
  vwm_participant: AssessmentParticipantStatus;
  dccs_participant: AssessmentParticipantStatus;
  cd_participant: AssessmentParticipantStatus;
  overall_participant: AssessmentParticipantStatus;
  common_participant_ids: string[];
  participant_statuses: AssessmentToolParticipantStatus[];
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
