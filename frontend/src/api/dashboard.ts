import { apiGet, withRefresh } from "./client";
import type {
  DemographicsResponse,
  OverviewResponse,
  ProgressResponse,
  RegistryResponse,
  UnavailableModule,
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

export function getHealthScreening(): Promise<UnavailableModule> {
  return apiGet<UnavailableModule>("/dashboard/health");
}

export function getPhysicalActivity(): Promise<UnavailableModule> {
  return apiGet<UnavailableModule>("/dashboard/physical-activity");
}

export function getScreenTime(): Promise<UnavailableModule> {
  return apiGet<UnavailableModule>("/dashboard/screen-time");
}

export function getNeurodevelopment(): Promise<UnavailableModule> {
  return apiGet<UnavailableModule>("/dashboard/neurodevelopment");
}

export function getProgress(opts?: { force?: boolean }): Promise<ProgressResponse> {
  return apiGet<ProgressResponse>(withRefresh("/dashboard/progress", opts?.force));
}
