export const WORKSPACE_CURRENCY = "USD";

export function formatMoney(amount: number | string, currency = WORKSPACE_CURRENCY) {
  const n = Number(amount);
  const value = Number.isFinite(n)
    ? n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0,00";
  if (currency === "USD") return `$ ${value}`;
  if (currency === "PEN") return `S/ ${value}`;
  return `${value} ${currency}`;
}
