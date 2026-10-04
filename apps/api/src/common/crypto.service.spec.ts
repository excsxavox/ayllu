import { ConfigService } from "@nestjs/config";
import { CryptoService } from "./crypto.service";

describe("CryptoService", () => {
  const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const crypto = new CryptoService({
    get: (k: string) => (k === "ENCRYPTION_KEY" ? key : undefined),
  } as ConfigService);

  it("cifra y descifra un token", () => {
    const enc = crypto.encrypt("meta-token-secreto");
    expect(enc).not.toContain("meta-token-secreto");
    expect(crypto.decrypt(enc)).toBe("meta-token-secreto");
  });

  it("no deja el secreto en texto plano", () => {
    const enc = crypto.encrypt("sk-live-abc");
    expect(enc.split(":").length).toBe(3);
  });
});
