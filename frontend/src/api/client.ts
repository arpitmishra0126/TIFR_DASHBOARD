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

function filenameFromContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="?([^";]+)"?/i.exec(headerValue);
  return match ? match[1] : null;
}

/** Fetches a binary file response and triggers a browser download for it. */
export async function apiDownload(path: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new ApiError(`GET ${path} failed with status ${response.status}`, response.status);
  }
  const blob = await response.blob();
  const filename = filenameFromContentDisposition(response.headers.get("content-disposition")) ?? fallbackFilename;

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
