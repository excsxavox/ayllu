import { pctDelta } from "./dashboard.service";

describe("pctDelta", () => {
  it("calcula el cambio semanal", () => {
    expect(pctDelta(12, 10)).toBe(20);
    expect(pctDelta(8, 10)).toBe(-20);
  });

  it("si la semana previa era 0, el alza es 100 o 0", () => {
    expect(pctDelta(4, 0)).toBe(100);
    expect(pctDelta(0, 0)).toBe(0);
  });
});
