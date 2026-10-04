# Checklist Meta WhatsApp Cloud API (AYLLUU)

El bot inbound (el cliente escribe primero) es el camino más simple. Iniciar conversaciones requiere plantillas aprobadas.

## Cuenta y app

- [ ] Cuenta Meta Business verificada
- [ ] App en developers.facebook.com con producto WhatsApp
- [ ] WhatsApp Business Account (WABA) y número de prueba o producción
- [ ] `phone_number_id` y `waba_id` copiados al panel (Ajustes)

## Tokens (se cifran en PostgreSQL, nunca se loguean)

- [ ] Token de acceso permanente o de sistema (no pegar en el chat ni en git)
- [ ] Verify token propio, el mismo en Meta y en AYLLUU
- [ ] App Secret para validar `X-Hub-Signature-256`

## Webhook

- [ ] URL pública HTTPS: `https://<tu-dominio>/webhooks/whatsapp`
- [ ] En local: túnel (ngrok/cloudflare) hacia `http://localhost:3001/webhooks/whatsapp`
- [ ] Suscripción al campo `messages`
- [ ] Meta puede hacer GET de verificación; AYLLUU responde el `hub.challenge` en texto plano

## Mensajería

- [ ] Ventana de 24 h: respuestas libres al inbound del cliente
- [ ] Fuera de ventana o inicio de conversación: plantilla aprobada (fuera de v1)
- [ ] Cumplir política de opt-in; no usar el bot para spam

## Multiempresa

- [ ] Cada empresa tiene su propio `phone_number_id`
- [ ] No reutilizar el mismo número en dos tenants
- [ ] El orquestador resuelve `companyId` por `WhatsAppAccount`

## Seguridad

- [ ] `ENCRYPTION_KEY` de 32 bytes (hex) distinta en producción
- [ ] Rotar access token si se filtra
- [ ] Rate limit activo en la API (el webhook está exceptuado)
