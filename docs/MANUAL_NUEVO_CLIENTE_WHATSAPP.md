# Manual: implementar WhatsApp para un cliente nuevo

Guía para el equipo AYLLUU. Sirve para dejar un negocio (por ejemplo un lodge, un restaurante o un campamento) atendiendo por WhatsApp con el panel, el bot y el CRM.

El cliente escribe primero. AYLLUU responde dentro de la ventana de 24 horas. Un número de WhatsApp es de **una sola empresa**. No se reutiliza.

Detalle técnico de Meta: [META_CHECKLIST.md](./META_CHECKLIST.md).

---

## 1. Qué pedirle al cliente antes de tocar el panel

Sin esto no se conecta el canal ni se entrena al asistente.

**Negocio**

- Nombre comercial y zona horaria (ej. `America/Guayaquil`, `America/Lima`)
- Quién será admin de la empresa (nombre, correo)
- Quién atenderá la bandeja (agentes)

**WhatsApp Business**

- Número que usarán con los clientes (no el personal de alguien)
- Acceso a la cuenta Meta Business / WhatsApp Business
- Si ya tienen app de desarrollador: Phone Number ID, WABA ID, token

**Contenido que el bot va a decir**

- Cómo quieren que salude (una frase corta; no un folleto)
- Horario, cómo llegar (link de mapa), normas, FAQ
- Servicios con precio en USD y fotos si hace falta (glamping, acampar, botes…)
- Productos (entrada al lago, adiciones)
- Promociones vigentes
- Cuenta para el abono: banco, tipo, número, titular (el bot no cobra en línea)
- Si reservan: % de abono (por defecto 50), qué se reserva, cupos del día

**Reglas de atención**

- ¿El bot responde a todos los que escriben? (rol Cliente)
- ¿Hay números internos que el bot no debe atender? (rol Contacto)
- Quién toma el chat cuando piden un asesor

No pidas el access token por WhatsApp ni lo pegues en tickets abiertos. Se carga en **Configuración** y queda cifrado.

---

## 2. Crear el espacio del cliente

Hay dos caminos.

**A. El cliente se da de alta**

1. Entra a `/register` del panel WhatsApp.
2. Pone su nombre, correo, contraseña y el nombre de la empresa.
3. Entra directo a Inicio. Queda como admin de esa empresa.

**B. Lo crea AYLLUU (recomendado en un onboarding)**

1. Entra como **Admin AYLLUU** (`PLATFORM_ADMIN`).
2. Ve a **Planes**.
3. Crea o abre la empresa.
4. Invita al admin del cliente: nombre, correo, contraseña (o vacía si ya tiene cuenta) y rol **Admin de empresa**.
5. Invita a los agentes con rol **Agente**.
6. Si el cliente reserva mesas o estadías, **activa el módulo** de agenda.

Roles:

| Rol | Qué hace |
| --- | --- |
| Admin AYLLUU | Planes, Auditoría, activa módulos |
| Admin de empresa | WhatsApp, catálogo, bot, equipo |
| Agente | Bandeja, CRM y reservas del día |

Un número, una empresa. Si el cliente ya usaba el número en otro espacio, primero desactívalo ahí.

---

## 3. Meta: dejar el número listo

Hazlo con el cliente o con su agencia. En developers.facebook.com:

1. Cuenta Meta Business **verificada**.
2. App con producto **WhatsApp**.
3. WhatsApp Business Account y el número (prueba primero, producción después).
4. Copia:
   - Phone Number ID
   - WABA ID
   - Access token **permanente** o de sistema
   - App Secret
5. Inventa un **verify token** (frase larga, solo tuya). El mismo valor va en Meta y en AYLLUU.

En Meta, el webhook apunta a la API, no al panel:

```
https://<dominio-de-la-api>/webhooks/whatsapp
```

En local, un túnel hacia el puerto 3001:

```
https://<tu-tunel>/webhooks/whatsapp
```

Suscripción: campo **messages**. Meta hace un GET de verificación; AYLLUU responde el `hub.challenge`.

No inicies conversaciones desde AYLLUU. Si el cliente no ha escrito, Meta exige plantilla aprobada (fuera de esta versión).

---

## 4. Pegar el canal en AYLLUU

Entra al espacio de la empresa → **Configuración**.

### WhatsApp

| Campo | Qué poner |
| --- | --- |
| Proveedor | Meta Cloud API |
| Phone Number ID | El de la app de Meta |
| WABA ID | El de la cuenta WABA |
| Teléfono visible | El número que ve la gente (+593…) |
| Access token | Token permanente |
| Verify token | El mismo que en el webhook de Meta |
| App secret | El de la app (firma `X-Hub-Signature-256`) |

Guarda con **Guardar canal**. Los secretos no se vuelven a mostrar; si cambian, se pegan de nuevo.

### Lugar

Pega el link del mapa. El bot solo lo manda si preguntan dónde queda o cómo llegar. No sale en el saludo.

### Modelo y tono

- **Tono**: cercano, breve. El bot no debe parecer un menú automático.
- **Prompt de sistema**: quién es, dónde está, que pregunte qué quiere la persona, que no suelte precios ni el mapa si no se los piden.
- **API key**: la de la empresa, o deja vacía si el servidor ya tiene `OPENAI_API_KEY`.
- Modelo chat: `gpt-4o-mini` (o el que usen). Embeddings: `text-embedding-3-small`.

Sin clave de LLM el bot no arma respuestas largas. El CRM y los datos de abono sí pueden seguir.

---

## 5. Canal y flujo

Al crear la empresa, AYLLUU arma solo:

- Canal **WhatsApp** (activo)
- Flujo **Flujo principal**

En **Canales**:

1. Abre el canal WhatsApp.
2. Confirma que está **activo** y usa el flujo principal.
3. El teléfono visible debe coincidir con el de Configuración.

En **Flujos**:

1. Revisa el modo de respuesta (Automático / Híbrido / Manual).
2. Deja Automático para el día uno, salvo que el cliente quiera tomar todo el chat.

No hace falta Instagram ni Messenger en este panel. Solo WhatsApp.

---

## 6. Cargar lo que el asistente puede decir

Orden que funciona en la práctica. No subas un PDF único con todo.

### Conocimiento — un tema por documento

En **Conocimiento**, crea documentos cortos, por tema:

- Saludo / bienvenida
- Horario
- Cómo llegar (sin sustituir el mapa de Configuración)
- Entrada al lago
- Acampar / glamping (normas, no solo precio)
- Grupos
- FAQ (mascotas, lluvia, niños…)

Un documento = un tema. Así el bot no suelta el folleto entero.

### Servicios

En **Servicios**, cada experiencia: nombre, descripción, precio en **USD**, fotos si el cliente las pide por chat (glamping, acampar, botes, pesca…).

### Productos

En **Productos**: entradas, adiciones, tienda. Precios en USD. Si un producto es extra de un servicio, enlázalo.

### Promociones

Solo las vigentes. Pueden ser %, monto fijo o 2x1, con fotos si aplica. Quita las de ejemplo.

### Pagos

En **Pagos**, una transferencia activa: banco, tipo de cuenta, número, titular. El bot la usa cuando piden reservar o el número de cuenta. El abono por defecto es 50% (Agenda → ajustes).

### Etiquetas

En **Etiquetas**, crea las que el equipo va a usar (Nuevo, VIP, Pago pendiente…). También se pueden importar de WhatsApp Business.

### Respuestas

En **Respuestas**, plantillas cortas para la bandeja (horario, abono, “te paso con un asesor”). El equipo las pega; el cliente no ve que son plantillas.

### Reglas del bot

En **Reglas del bot**, deja al menos:

- Saludo breve
- Horario
- Pasar a humano (handover)
- Etiquetar si hace falta

El saludo pregunta qué quiere la persona. No lista precios.

---

## 7. Agenda (si el plan la incluye)

1. En **Planes**, activa el módulo de esa empresa.
2. En **Agenda**, define horarios, cupos, servicios o productos reservables, % de abono y si el bot puede tomar reserva.
3. **Piso** (`:3005` en local) es para quien anota reservas a mano en el local. No va en el menú de WhatsApp.

---

## 8. CRM y bandeja

No se configura aparte. Quien escribe por WhatsApp entra solo.

| Qué escribe el cliente | Qué hace el CRM |
| --- | --- |
| Hola | Nuevo |
| Sigue el chat | Conversación |
| Precios, fotos, “quiero glamping” | Interesado (y valor si reconoce el servicio) |
| Datos para reservar / abono / cuenta | Reserva |
| Reserva creada o completada en Agenda | Reserva / Cerrado |

En la **Bandeja**:

- El bot atiende a quien tiene rol **Cliente**.
- **Silenciar bot** (rol Contacto) = solo humanos.
- Las notas de la bandeja se guardan en el CRM.
- **Abrir en CRM** abre la ficha.

Marca como Contacto a proveedores, staff y números de prueba para que el bot no les responda.

---

## 9. Prueba antes de entregar

Hazla con un celular que no sea el número del negocio.

1. Escribe “Hola”. Debe saludar corto y preguntar qué quiere. Sin mapa ni lista de precios.
2. Pregunta “¿cuánto cuesta acampar?”. Precio en dólares. En el CRM: Interesado.
3. Pide fotos si hay imágenes en Servicios.
4. Pregunta dónde queda. Sale el mapa.
5. Pregunta el horario. Sale el horario, no todo lo demás.
6. Di “quiero reservar el sábado” o “pásame los datos para reservar”. Debe pedir el abono y la cuenta.
7. En **Bandeja** ves el hilo. En **CRM** ves la tarjeta moverse.
8. Toma el chat (asesor). El bot se calla. Suéltalo y vuelve a escribir: el bot retoma.
9. Desde otro número interno, márcalo Contacto y confirma que el bot no responde.

Si el paso 1 no llega:

- El webhook de Meta está en la **API**, no en el puerto 3000.
- Phone Number ID no coincide con el de Configuración.
- Verify token distinto en Meta y en AYLLUU.
- Canal WhatsApp inactivo.
- Redis caído (la cola inbound no procesa).
- El número está en otra empresa.

---

## 10. Entregar al cliente

Qué les muestras el día de go-live:

1. **Inicio** — qué quedó pendiente.
2. **Bandeja** — responder, tomar el chat, notas, silenciar bot.
3. **CRM** — embudo y ficha. Que no borren gente por limpiar.
4. **Agenda** — si está activa.
5. Quién cambia catálogo y conocimiento (admin de empresa), quién solo atiende (agente).

Qué se quedan ellos:

- No reenviar el access token.
- Avisar si cambian de número o de banco.
- Un tema nuevo = un documento nuevo en Conocimiento.
- El bot no inicia chats fríos.

---

## 11. Checklist de cierre

- [ ] Empresa creada, timezone correcto
- [ ] Admin y agentes invitados
- [ ] Módulo Agenda on/off según el plan
- [ ] Meta: app, WABA, número, webhook `messages`, verify token igual en ambos lados
- [ ] Configuración: Phone Number ID, token, verify, app secret, mapa, tono, prompt, LLM
- [ ] Canal WhatsApp activo + flujo principal
- [ ] Conocimiento por temas (no un solo bloque)
- [ ] Servicios y productos con USD y fotos necesarias
- [ ] Promociones reales (sin ejemplos)
- [ ] Transferencia activa para el abono
- [ ] Prueba 1–9 de la sección 9 en verde
- [ ] Números internos en rol Contacto
- [ ] Cliente sabe usar bandeja y CRM

Cuando esto está tildado, el WhatsApp del cliente nuevo está implementado.
