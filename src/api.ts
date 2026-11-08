// Every call to DeckShelf's own /api goes through here. The app can also be opened
// from a static host or a file copy, where /api answers with an HTML page, so the
// status and content type are checked before anything is parsed.

export const NO_SERVER = "Reading Archidekt needs the DeckShelf app or its local server (npm start or npm run dev).";
export const UNREACHABLE = "Could not reach Archidekt.";

export class ApiError extends Error {
  status: number;
  // False when the server says trying again cannot help (a private or deleted deck).
  retry: boolean;
  constructor(message: string, status: number, retry: boolean) {
    super(message);
    this.status = status;
    this.retry = retry;
  }
}

export async function apiJson<T = any>(path: string, { signal, fallback, timeout = 60000, request = fetch }: {
  signal?: AbortSignal;
  /** Shown when the server gives no message of its own. */
  fallback: string;
  timeout?: number;
  request?: typeof fetch;
}): Promise<T> {
  const limit = AbortSignal.timeout(timeout);
  let response: Response;
  try {
    response = await request(path, { signal: signal ? AbortSignal.any([signal, limit]) : limit });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(limit.aborted ? `${UNREACHABLE} It took too long to answer.` : UNREACHABLE, 0, true);
  }
  const json = response.headers.get("content-type")?.includes("application/json");
  // A static host answers /api with its index page (200) or its own error page.
  if (!json) throw new ApiError(response.ok ? NO_SERVER : fallback, response.status, true);
  let data: any;
  try { data = await response.json(); }
  catch { throw new ApiError(fallback, response.status, true); }
  if (!response.ok) throw new ApiError(typeof data?.error === "string" && data.error ? data.error : fallback, response.status, data?.retry !== false);
  return data as T;
}
