import { Injectable } from "@nestjs/common";
import { WhatsAppProvider } from "@aylluu/shared";
import { WhatsAppChannel } from "./provider.interface";
import { MetaCloudApiProvider } from "./meta.provider";
import { EvolutionProvider } from "./evolution.provider";

@Injectable()
export class WhatsAppAdapterService {
  constructor(
    private readonly meta: MetaCloudApiProvider,
    private readonly evolution: EvolutionProvider,
  ) {}

  resolve(provider: WhatsAppProvider = "META"): WhatsAppChannel {
    if (provider === "EVOLUTION") return this.evolution;
    return this.meta;
  }
}
