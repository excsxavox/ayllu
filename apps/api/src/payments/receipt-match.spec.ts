import { accountsMatch, findMatchingAccount, isReceiptMedia, parseReceiptScan } from "./receipt-match";

describe("receipt-match", () => {
  it("cruza el número de cuenta aunque venga con espacios", () => {
    expect(accountsMatch("2200 000 000", "2200000000")).toBe(true);
    expect(accountsMatch("1111", "2200000000")).toBe(false);
  });

  it("elige el método cuya cuenta aparece en el comprobante", () => {
    const hit = findMatchingAccount("cuenta 2200000000 Banco Pichincha", [
      { name: "Pichincha", accountNumber: "2200000000" },
      { name: "Pacífico", accountNumber: "1100110011" },
    ]);
    expect(hit?.name).toBe("Pichincha");
  });

  it("lee el JSON del análisis de la imagen", () => {
    const scan = parseReceiptScan('```json\n{"accountNumber":"2200000000","amount":"20","bank":"Pichincha","looksLikeTransfer":true}\n```');
    expect(scan.accountNumber).toBe("2200000000");
    expect(scan.looksLikeTransfer).toBe(true);
  });

  it("reconoce fotos y documentos como comprobante", () => {
    expect(isReceiptMedia("image")).toBe(true);
    expect(isReceiptMedia("text")).toBe(false);
  });
});
