export type ReceiptScan = {
  accountNumber: string;
  amount: string;
  bank: string;
  looksLikeTransfer: boolean;
};

export function digitsOnly(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function accountsMatch(extracted: string, stored: string): boolean {
  const a = digitsOnly(extracted);
  const b = digitsOnly(stored);
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function findMatchingAccount<T extends { accountNumber?: string | null; name?: string | null; bank?: string | null }>(
  extracted: string,
  methods: T[],
): T | null {
  return methods.find((method) => method.accountNumber && accountsMatch(extracted, method.accountNumber)) ?? null;
}

export function parseReceiptScan(raw: string): ReceiptScan {
  const empty: ReceiptScan = { accountNumber: "", amount: "", bank: "", looksLikeTransfer: false };
  const text = raw.trim();
  if (!text) return empty;
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Partial<ReceiptScan>;
      return {
        accountNumber: String(parsed.accountNumber ?? ""),
        amount: String(parsed.amount ?? ""),
        bank: String(parsed.bank ?? ""),
        looksLikeTransfer: Boolean(parsed.looksLikeTransfer),
      };
    } catch {
      /* fall through */
    }
  }
  const digits = text.match(/\d[\d\s.-]{5,}\d/g)?.map(digitsOnly).sort((a, b) => b.length - a.length)[0] ?? "";
  return {
    accountNumber: digits,
    amount: "",
    bank: "",
    looksLikeTransfer: /\b(transfer|deposito|dep[oó]sito|comprobante|cuenta)\b/i.test(text),
  };
}

export function isReceiptMedia(type?: string | null): boolean {
  return type === "image" || type === "document";
}
