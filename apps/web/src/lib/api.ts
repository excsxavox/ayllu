import { ALL_PREFETCH, getInflight, invalidateCache, peekCache, setInflight, writeCache } from "@/lib/query-cache";

const REMOTE_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const API =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_AYLLUU_APP === "movil"
    ? "/backend"
    : REMOTE_API;

export function mediaUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API}${path.startsWith("/") ? path : `/${path}`}`;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  platformRole: "USER" | "PLATFORM_ADMIN";
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  role?: string;
  timezone?: string;
  bookingsEnabled?: boolean;
};

type Stored = {
  accessToken: string;
  refreshToken: string;
  companyId: string | null;
};

const KEY = "aylluu.session";

export function getSession(): Stored | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Stored) : null;
}

export function setSession(data: Stored) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function setCompanyId(companyId: string) {
  const s = getSession();
  if (!s) return;
  setSession({ ...s, companyId });
}

export function prefetch(path: string) {
  void api(path).catch(() => undefined);
}

export function prefetchMany(paths: string[]) {
  for (const path of paths) prefetch(path);
}

export function prefetchApp() {
  prefetchMany(ALL_PREFETCH);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET") {
    const pending = getInflight<T>(path);
    if (pending) return pending;
  }

  const session = getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (session?.companyId) headers.set("X-Company-Id", session.companyId);

  const request = doFetch<T>(path, init, headers, session);
  if (method === "GET") setInflight(path, request);
  const data = await request;
  if (method === "GET") writeCache(path, data);
  else invalidateCache(path);
  return data;
}

async function doFetch<T>(
  path: string,
  init: RequestInit,
  headers: Headers,
  session: Stored | null,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch {
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET") {
      const cached = peekCache<T>(path);
      if (cached !== undefined) return cached;
    }
    throw new Error("No se pudo conectar con el servidor. Revisa que la API esté en el puerto 3001.");
  }
  if (res.status === 401 && session?.refreshToken && path !== "/auth/refresh") {
    const refreshed = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (refreshed.ok) {
      const tokens = (await refreshed.json()) as { accessToken: string; refreshToken: string };
      setSession({ ...session, ...tokens });
      headers.set("Authorization", `Bearer ${tokens.accessToken}`);
      return doFetch<T>(path, init, headers, { ...session, ...tokens });
    }
    clearSession();
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || "Error de API");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const session = getSession();
  const headers = new Headers();
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (session?.companyId) headers.set("X-Company-Id", session.companyId);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API}${path}`, { method: "POST", headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || "Error al subir");
  }
  return res.json() as Promise<T>;
}
