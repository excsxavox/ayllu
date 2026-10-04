import { MetaCloudApiProvider } from "./meta.provider";

describe("MetaCloudApiProvider", () => {
  const provider = new MetaCloudApiProvider();

  it("verifica el challenge de Meta", () => {
    const challenge = provider.verifyWebhook(
      { "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "123" },
      "abc",
    );
    expect(challenge).toBe("123");
  });

  it("normaliza un inbound de texto", () => {
    const messages = provider.parseInbound({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pn-1" },
                contacts: [{ profile: { name: "Ana" }, wa_id: "51911111111" }],
                messages: [
                  {
                    id: "wamid.1",
                    from: "51911111111",
                    timestamp: "1710000000",
                    type: "text",
                    text: { body: "Hola" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].phoneNumberId).toBe("pn-1");
    expect(messages[0].text).toBe("Hola");
    expect(messages[0].from).toBe("51911111111");
  });

  it("normaliza una foto de comprobante", () => {
    const messages = provider.parseInbound({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pn-1" },
                messages: [
                  {
                    id: "wamid.img",
                    from: "51911111111",
                    timestamp: "1710000000",
                    type: "image",
                    image: { id: "media-9", mime_type: "image/jpeg", caption: "comprobante" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages[0].type).toBe("image");
    expect(messages[0].mediaId).toBe("media-9");
    expect(messages[0].text).toBe("comprobante");
  });
});
