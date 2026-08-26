import { apiGet } from "./client";
import type {
  DemographicsResponse,
  OverviewResponse,
  ProgressResponse,
  RegistryResponse,
  UnavailableModule,
} from "../types/liveDashboard";

export function getOverview(): Promise<OverviewResponse> {
  return apiGet<OverviewResponse>("/dashboard/overview");
}

export interface RegistryQuery {
  search?: string;
  sex?: string;
  village?: string;
  limit?: number;
  offset?: number;
}

export function getRegistry(query: RegistryQuery = {}): Promise<RegistryResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.sex) params.set("sex", query.sex);
  if (query.village) params.set("village", query.village);
  params.set("limit", String(query.limit ?? 50));
  params.set("offset", String(query.offset ?? 0));
  return apiGet<RegistryResponse>(`/dashboard/registry?${params.toString()}`);
}

export function getDemographics(): Promise<DemographicsResponse> {
  return apiGet<DemographicsResponse>("/dashboard/demographics");
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

export function getProgress(): Promise<ProgressResponse> {
  return apiGet<ProgressResponse>("/dashboard/progress");
}
