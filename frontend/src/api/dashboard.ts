import { apiDownload, apiGet, withRefresh } from "./client";
import type {
  DemographicsResponse,
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
  limit?: number;
  offset?: number;
  force?: boolean;
}

export function getRegistry(query: RegistryQuery = {}): Promise<RegistryResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.sex) params.set("sex", query.sex);
  if (query.village) params.set("village", query.village);
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

export function getNeurodevelopment(opts?: { force?: boolean }): Promise<NeurodevelopmentResponse> {
  return apiGet<NeurodevelopmentResponse>(withRefresh("/dashboard/neurodevelopment", opts?.force));
}

export function getProgress(opts?: { force?: boolean }): Promise<ProgressResponse> {
  return apiGet<ProgressResponse>(withRefresh("/dashboard/progress", opts?.force));
}

export function exportActiveCases(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  return apiDownload("/dashboard/export/active-cases", `ICMR_Active_Cases_${today}.xlsx`);
}

export function exportActiveCasesCsv(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  return apiDownload("/dashboard/export/active-cases.csv", `ICMR_Active_Cases_${today}.csv`);
}
