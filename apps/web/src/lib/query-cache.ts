const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const LS = "aylluu.qcache";
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) memory.set(key, value);
  } catch {
    /* ignore broken cache */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of memory) obj[key] = value;
    localStorage.setItem(LS, JSON.stringify(obj));
  } catch {
    /* quota or private mode */
  }
}

function companyId() {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("aylluu.session");
    return raw ? ((JSON.parse(raw) as { companyId?: string | null }).companyId ?? "") : "";
  } catch {
    return "";
  }
}

export const PREFETCH: Record<string, string[]> = {
  "/dashboard": ["/dashboard"],
  "/inbox": ["/conversations", "/channels"],
  "/contacts": ["/contacts", "/tags"],
  "/alerts": ["/alerts"],
  "/products": ["/products", "/categories"],
  "/services": ["/services"],
  "/promotions": ["/promotions", "/services", "/products"],
  "/tags": ["/tags", "/contacts"],
  "/knowledge": ["/knowledge"],
  "/rules": ["/rules", "/flows"],
  "/channels": ["/channels", "/flows"],
  "/flows": ["/flows"],
  "/replies": ["/replies", "/companies/current"],
  "/settings": ["/settings/whatsapp", "/settings/ai"],
  "/payments": ["/payments"],
  "/audit": ["/audit"],
  "/bookings": ["/bookings", "/bookings/settings", "/services", "/products"],
  "/floor": ["/bookings/settings", "/services", "/products"],
  "/admin": ["/admin/companies"],
};

export function cacheKey(path: string) {
  return `${companyId()}:${path}`;
}

export function peekCache<T>(path: string): T | undefined {
  hydrate();
  return memory.get(cacheKey(path)) as T | undefined;
}

export function writeCache(path: string, value: unknown) {
  hydrate();
  memory.set(cacheKey(path), value);
  persist();
}

export function getInflight<T>(path: string) {
  return inflight.get(cacheKey(path)) as Promise<T> | undefined;
}

export function setInflight<T>(path: string, promise: Promise<T>) {
  const key = cacheKey(path);
  inflight.set(key, promise);
  void promise.finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
}

export function invalidateCache(path: string) {
  const root = path.split("/").filter(Boolean)[0] ?? "";
  const also = root === "prices" ? ["products", "services"] : root === "admin" ? ["bookings", "companies"] : [];
  if (["products", "services", "promotions", "knowledge", "rules", "replies", "alerts", "bookings", "channels", "flows"].includes(root)) {
    also.push("dashboard");
  }
  for (const key of [...memory.keys()]) {
    if (key.includes(`/${root}`) || also.some((a) => key.includes(`/${a}`))) {
      memory.delete(key);
    }
  }
  persist();
}

export function clearCompanyCache() {
  hydrate();
  const prefix = `${companyId()}:`;
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  persist();
}

export const ALL_PREFETCH = [
  ...new Set(
    Object.entries(PREFETCH)
      .filter(([path]) => path !== "/admin" && path !== "/audit")
      .flatMap(([, paths]) => paths),
  ),
];
