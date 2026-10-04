/** Piso / móvil siempre habla con la API del servidor. */
export const SERVER_API = "http://api.84.247.178.247.sslip.io";

export function movilEnv() {
  return {
    AYLLUU_APP: "movil",
    NEXT_PUBLIC_AYLLUU_APP: "movil",
    PORT: "3005",
    NEXT_PUBLIC_API_URL: SERVER_API,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
