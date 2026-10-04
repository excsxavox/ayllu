import { RulesService } from "./rules.service";

describe("RulesService.isWithinHours", () => {
  const service = new RulesService({} as never, {} as never);

  it("detecta horario con timezone", () => {
    const mondayNoonUtc = new Date("2026-03-02T17:00:00.000Z");
    const inside = service.isWithinHours(
      { days: [1], startTime: "09:00", endTime: "19:00" },
      "America/Lima",
      mondayNoonUtc,
    );
    expect(inside).toBe(true);
  });

  it("lee grupos de 15 o más", () => {
    expect(service.parseGuestCount("somos 15 personas")).toBe(15);
    expect(service.parseGuestCount("grupo de quince")).toBe(15);
    expect(service.parseGuestCount("vamos 8 pax")).toBe(8);
    expect(service.parseGuestCount("hola quiero info")).toBeNull();
  });

  it("lee 12 o más y un número suelto si se pidió el dato", () => {
    expect(service.parseGuestCount("somos 12")).toBe(12);
    expect(service.parseGuestCount("doce personas")).toBe(12);
    expect(service.parseGuestCount("para 4")).toBe(4);
    expect(service.parseGuestCount("12", { allowBare: true })).toBe(12);
    expect(service.parseGuestCount("4", { allowBare: true })).toBe(4);
    expect(service.parseGuestCount("cuánto cobran la entrada\n12")).toBe(12);
    expect(service.parseGuestCount("12")).toBeNull();
  });

  it("rechaza fuera de horario", () => {
    const late = new Date("2026-03-02T04:00:00.000Z");
    const inside = service.isWithinHours(
      { days: [1], startTime: "09:00", endTime: "19:00" },
      "America/Lima",
      late,
    );
    expect(inside).toBe(false);
  });
});
