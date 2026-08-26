/**
 * Dashboard-facing types mirroring the backend Pydantic schemas
 * (backend/app/schemas). Keep in sync with the approved V1 spec —
 * do not add fields outside data/ICMR_Neurodevelopment_Dashboard_V1_Variable_Spec.docx.
 */

export interface ChildRead {
  id: number;
  redcap_child_id: string;
  sex: string | null;
  dob: string | null;
  age_years: number | null;
  village: string | null;
  child_status: string | null;
  visit_date: string | null;
  registration_complete: boolean;
}

export interface ChildSummary {
  total_registered: number;
}

export interface SESProfileRead {
  child_id: number;
  udai_pareek_score: number | null;
  udai_pareek_category: string | null;
  bg_prasad_category: string | null;
  per_capita_income: number | null;
  household_size: number | null;
}

export interface HealthScreeningRead {
  child_id: number;
  current_illness_flag: boolean | null;
  chronic_condition_flag: boolean | null;
  neurodev_condition_flag: boolean | null;
  hospitalisation_flag: boolean | null;
  assessment_eligibility_decision: string | null;
}

export interface PhysicalActivityRead {
  child_id: number;
  item1_composite_score: number | null;
  item8_composite_score: number | null;
  paqa_final_score: number | null;
}

export interface ScreenTimeRead {
  child_id: number;
  total_daily_screen_time: string | null;
  tv_frequency: string | null;
  smartphone_frequency: string | null;
  laptop_frequency: string | null;
  educational_use_flag: boolean | null;
  entertainment_use_flag: boolean | null;
}

export interface NeurodevelopmentAssessmentRead {
  child_id: number;
  teacher_academic_performance: string | null;
  teacher_reading_ability: string | null;
  teacher_math_ability: string | null;
  teacher_academic_motivation: string | null;
  teacher_learning_ability: string | null;
  teacher_classroom_behaviour: string | null;
}

export interface AssessmentProgressRead {
  child_id: number;
  registration_complete: boolean;
  ses_complete: boolean;
  screen_time_complete: boolean;
  health_screening_complete: boolean;
  physical_activity_complete: boolean;
  nutrition_complete: boolean;
  parent_report_complete: boolean;
  child_report_complete: boolean;
  teacher_report_complete: boolean;
  overall_status: string;
}
