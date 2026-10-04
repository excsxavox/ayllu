import { chunkText } from "./knowledge-chunk";

describe("chunkText", () => {
  it("parte por párrafos y no deja un folleto entero", () => {
    const chunks = chunkText("Horario.\n\nAtendemos las 24 horas.\n\nLa entrada se cotiza aparte.", 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((c) => c.includes("Horario") && c.includes("entrada"))).toBe(false);
  });

  it("deja un tema corto en un solo bloque", () => {
    expect(chunkText("Ayllu atiende las 24 horas.")).toEqual(["Ayllu atiende las 24 horas."]);
  });
});
