# AYLLU — Sitio público

En este repositorio corre en **http://localhost:3002** con `pnpm dev:sitio`. El panel WhatsApp sigue en el puerto 3000.

## Abrir la plantilla

Extrae el ZIP y abre `index.html`. Mantén todos los archivos en la misma carpeta para que carguen los estilos y las interacciones. No necesitas instalar Node ni dependencias. También puedes usar Live Server en Visual Studio Code.

En el repositorio, los archivos de la página están en `dist/`.

## Reserva interactiva

1. Elige glamping, restaurante, pesca, botes a remo o senderismo y el número de personas.
2. Consulta el calendario: disponible, pocos cupos o sin cupo. Selecciona un horario; para glamping, elige llegada y noches.
3. Revisa los detalles, añade otros intereses y pulsa **Simular reserva**.

Si una fecha no tiene cupo para el grupo, se muestran fechas alternativas. Para una estancia, la misma unidad debe estar libre durante todas las noches; la fecha de salida no consume una noche adicional.

**Es una demostración.** Las capacidades, fechas ocupadas y horarios son ejemplos, no la agenda de AYLLU. No se cobran pagos, no se recogen datos personales y no se envían reservas. Las reservas de prueba descuentan cupos solo en la pestaña actual y se restablecen al recargar. El enlace a Facebook permite contactar directamente con el negocio.

## Archivos

- `index.html`: contenido, secciones y enlaces.
- `style.css`: diseño general adaptable y animaciones.
- `app.js`: carrusel y menú móvil.
- `booking.css`: diseño adaptable del módulo de reservas.
- `booking.js`: pasos, calendario, horarios, resumen y confirmación de prueba.
- `availability.js`: inventario demostrativo, validaciones y cálculo de cupos.
- `destination.jpg`: fotografía del paisaje.

## Personalizar y conectar la agenda real

Los servicios, horarios y capacidades de ejemplo están en `SERVICES`, dentro de `availability.js`. La función `baseUnits` genera el inventario ficticio. La consulta cubre los próximos 90 días, con hasta 7 noches de estancia y fechas según Ecuador continental.

Para usar reservas reales, hay que conectar la agenda de AYLLU a un servidor o sistema de reservas. El servidor debe devolver los cupos, validar y guardar cada reserva de forma atómica, y compartir el inventario entre visitantes. No uses el inventario del navegador como fuente de disponibilidad real.

## Carrusel y fotografía

Los textos cambian cada 8 segundos; la fotografía tiene un zoom lento de 24 segundos. Las flechas permiten cambiar de texto. Se eliminaron el botón Pausar y los indicadores 01–04.

El movimiento se detiene al colocar el mouse sobre la portada, usar sus controles con el teclado o cambiar de pestaña. Respeta la preferencia de movimiento reducido del sistema.

El arreglo `slides` en `app.js` define los textos y enlaces. Todas las diapositivas utilizan actualmente `destination.jpg`: no hay fotografías adicionales del restaurante o glamping. Puedes sustituirla por una fotografía propia conservando el nombre.

La fuente Inter se carga desde Google Fonts; sin conexión se utiliza Arial.

Fuente de la fotografía: https://ecuadormitierra.com/lagunas-del-ecuador2/laguna-tipopugro-en-la-reserva-antisana/
La licencia de reutilización no está verificada. Sustituye esta imagen por una propia o autorizada para el uso comercial definitivo.
