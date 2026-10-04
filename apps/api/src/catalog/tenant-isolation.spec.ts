import { NotFoundException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

describe("Aislamiento de tenant", () => {
  const catalog = new CatalogService({} as never, {} as never, {} as never);

  it("rechaza una entidad de otra empresa", async () => {
    await expect(
      catalog.assertOwned({ companyId: "empresa-a" }, "empresa-b", "Producto"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("acepta una entidad de la misma empresa", async () => {
    const row = await catalog.assertOwned({ companyId: "empresa-a", id: "1" }, "empresa-a", "Producto");
    expect(row.id).toBe("1");
  });

  it("el scope siempre incluye companyId", () => {
    const scoped = (catalog as unknown as { scoped: (id: string) => { companyId: string } }).scoped(
      "empresa-a",
    );
    expect(scoped).toEqual({ companyId: "empresa-a" });
  });
});
