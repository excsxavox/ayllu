function decodePayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { exp?: number; sub?: string };
  } catch {
    return null;
  }
}

export function looksLikeJwt(token: string) {
  const parts = token.split(".");
  return parts.length === 3 && parts.every(Boolean) && decodePayload(token) != null;
}

export function accessTokenExpired(token: string) {
  const payload = decodePayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}
