import { apiDownload, apiGet, withRefresh } from "./client";
import type {
  DemographicsResponse,
  DietaryIntakeResponse,
  HealthScreeningResponse,
  NeurodevelopmentResponse,
  OverviewResponse,
  PhysicalActivityResponse,
  ProgressResponse,
  RegistryResponse,
  ScreenTimeResponse,
} from "../types/liveDashboard";

export function getOverview(opts?: { force?: boolean }): Promise<OverviewResponse> {
  return apiGet<OverviewResponse>(withRefresh("/dashboard/overview", opts?.force));
}

export interface RegistryQuery {
  search?: string;
  sex?: string;
  village?: string;
  missingInstrument?: string;
  coreBatteryComplete?: boolean;
  progressionStage?: string;
  visitDateFrom?: string;
  visitDateTo?: string;
  dataReview?: boolean;
  limit?: number;
  offset?: number;
  force?: boolean;
}

function registryQueryParams(query: RegistryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.sex) params.set("sex", query.sex);
  if (query.village) params.set("village", query.village);
  if (query.missingInstrument) params.set("missing_instrument", query.missingInstrument);
  if (query.coreBatteryComplete !== undefined) params.set("core_battery_complete", String(query.coreBatteryComplete));
  if (query.progressionStage) params.set("progression_stage", query.progressionStage);
  if (query.visitDateFrom) params.set("visit_date_from", query.visitDateFrom);
  if (query.visitDateTo) params.set("visit_date_to", query.visitDateTo);
  if (query.dataReview) params.set("data_review", "true");
  return params;
}

export function getRegistry(query: RegistryQuery = {}): Promise<RegistryResponse> {
  const params = registryQueryParams(query);
  params.set("limit", String(query.limit ?? 50));
  params.set("offset", String(query.offset ?? 0));
  return apiGet<RegistryResponse>(withRefresh(`/dashboard/registry?${params.toString()}`, query.force));
}

export function getDemographics(opts?: { force?: boolean }): Promise<DemographicsResponse> {
  return apiGet<DemographicsResponse>(withRefresh("/dashboard/demographics", opts?.force));
}

export function getHealthScreening(opts?: { force?: boolean }): Promise<HealthScreeningResponse> {
  return apiGet<HealthScreeningResponse>(withRefresh("/dashboard/health", opts?.force));
}

export function getPhysicalActivity(opts?: { force?: boolean }): Promise<PhysicalActivityResponse> {
  return apiGet<PhysicalActivityResponse>(withRefresh("/dashboard/physical-activity", opts?.force));
}

export function getScreenTime(opts?: { force?: boolean }): Promise<ScreenTimeResponse> {
  return apiGet<ScreenTimeResponse>(withRefresh("/dashboard/screen-time", opts?.force));
}

export function getDietaryIntake(opts?: { force?: boolean }): Promise<DietaryIntakeResponse> {
  return apiGet<DietaryIntakeResponse>(withRefresh("/dashboard/dietary-intake", opts?.force));
}

export function getNeurodevelopment(opts?: { force?: boolean }): Promise<NeurodevelopmentResponse> {
  return apiGet<NeurodevelopmentResponse>(withRefresh("/dashboard/neurodevelopment", opts?.force));
}

export function getProgress(opts?: { force?: boolean }): Promise<ProgressResponse> {
  return apiGet<ProgressResponse>(withRefresh("/dashboard/progress", opts?.force));
}

export type RegistryFilterQuery = Omit<RegistryQuery, "limit" | "offset" | "force">;

export function exportActiveCases(query: RegistryFilterQuery = {}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const params = registryQueryParams(query).toString();
  const path = params ? `/dashboard/export/active-cases?${params}` : "/dashboard/export/active-cases";
  return apiDownload(path, `ICMR_Active_Cases_${today}.xlsx`);
}

export function exportActiveCasesCsv(query: RegistryFilterQuery = {}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const params = registryQueryParams(query).toString();
  const path = params ? `/dashboard/export/active-cases.csv?${params}` : "/dashboard/export/active-cases.csv";
  return apiDownload(path, `ICMR_Active_Cases_${today}.csv`);
}
