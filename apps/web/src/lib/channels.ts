export const CHANNEL_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  WHATSAPP: { label: "WhatsApp", color: "#147d63", bg: "#e7f6ef" },
  WEB: { label: "Chat web", color: "#1d4ed8", bg: "#dbeafe" },
  INSTAGRAM: { label: "Instagram", color: "#be185d", bg: "#fce7f3" },
  MESSENGER: { label: "Messenger", color: "#2563eb", bg: "#dbeafe" },
  TELEGRAM: { label: "Telegram", color: "#0284c7", bg: "#e0f2fe" },
};

export function channelMeta(type?: string | null) {
  return CHANNEL_META[type ?? ""] ?? { label: type || "Canal", color: "#475569", bg: "#e2e8f0" };
}
