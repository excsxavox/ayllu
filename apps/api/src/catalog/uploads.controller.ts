import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentTenant } from "../auth/decorators";
import { TenantContext } from "../common/types";

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

@Controller("uploads")
export class UploadsController {
  @Post("images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file?: { buffer?: Buffer; mimetype?: string; originalname?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Elige una imagen (jpg, png, webp o gif, máx. 5 MB).");
    }
    const ext = ALLOWED.get(file.mimetype ?? "") ?? extname(file.originalname ?? "").toLowerCase();
    if (![...ALLOWED.values()].includes(ext)) {
      throw new BadRequestException("Solo se aceptan imágenes jpg, png, webp o gif.");
    }
    const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    const dir = join(process.cwd(), "uploads", tenant.companyId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), file.buffer);
    return { url: `/uploads/${tenant.companyId}/${name}` };
  }
}
