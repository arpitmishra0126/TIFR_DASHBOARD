const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function withRefresh(path: string, force?: boolean): string {
  if (!force) return path;
  return path.includes("?") ? `${path}&refresh=true` : `${path}?refresh=true`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new ApiError(`GET ${path} failed with status ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}
