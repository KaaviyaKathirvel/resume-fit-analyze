import type {
  AnalyzeFitRequest,
  AnalyzeFitResponse,
  HealthResponse,
  RewriteBulletRequest,
  RewriteBulletResponse,
} from "./types";

export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? "http://localhost:8000"
).replace(/\/$/, "");

/**
 * Thrown for any non-2xx response or network failure. `status` is 0 for
 * network-level errors (backend down / CORS / DNS).
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    apiKey?: string;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const { method = "GET", body, apiKey, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (apiKey) headers["X-OpenAI-Key"] = apiKey;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "Could not reach the server. Make sure the backend is running and reachable.",
      0
    );
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : null) ?? `Request failed (${res.status}).`;
    throw new ApiError(detail, res.status);
  }

  return data as T;
}

export function analyzeFit(
  payload: AnalyzeFitRequest,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalyzeFitResponse> {
  return request<AnalyzeFitResponse>("/analyze-fit", {
    method: "POST",
    body: payload,
    apiKey,
    signal,
  });
}

export function rewriteBullet(
  payload: RewriteBulletRequest,
  apiKey: string,
  signal?: AbortSignal
): Promise<RewriteBulletResponse> {
  return request<RewriteBulletResponse>("/rewrite-bullet", {
    method: "POST",
    body: payload,
    apiKey,
    signal,
  });
}

export function checkHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", { signal });
}
