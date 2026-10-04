var AylluI18n = (() => {
  const KEY = "ayllu.lang";
  const langs = ["es", "en"];
  const dict = {
    es: {
      "meta.title": "AYLLU · Restaurante, pesca y glamping",
      "meta.description":
        "Descubre AYLLU en Laguna Tipopugro. Gastronomía, pesca, glamping y naturaleza para compartir.",
      "nav.brandSub": "RESTAURANTE · PESCA · GLAMPING",
      "nav.menu": "Menú",
      "nav.menuOpen": "Abrir menú",
      "nav.menuClose": "Cerrar menú",
      "nav.experiences": "Experiencias",
      "nav.restaurant": "Restaurante AYLLU",
      "nav.glamping": "Glamping",
      "nav.panel": "Panel",
      "nav.cta": "Consultar disponibilidad ↗",
      "nav.lang": "Idioma",
      "guard.translate": "El traductor del navegador está cambiando esta página. Desactívalo (icono de Google Translate) para ver AYLLU en el idioma elegido.",
      "guard.close": "Cerrar aviso",
      "hero.alt": "Laguna Tipopugro rodeada de montañas",
      "hero.prev": "Experiencia anterior",
      "hero.next": "Siguiente experiencia",
      "hero.discover": "DESCUBRE AYLLU",
      "hero.place": "NATURALEZA QUE CONECTA",
      "hero.carousel": "Descubre AYLLU",
      "strip.restaurant": "Restaurante AYLLU",
      "strip.fishing": "Pesca",
      "strip.glamping": "Glamping",
      "strip.nature": "Naturaleza",
      "exp.eyebrow": "SERVICIOS Y EXPERIENCIAS AYLLU",
      "exp.title": "Todo para disfrutar<br><em>tu visita.</em>",
      "exp.lead":
        "Gastronomía, actividades al aire libre y descanso en un solo lugar. Elige cómo quieres vivir AYLLU.",
      "exp.pesca.h": "Pesca en el lago",
      "exp.pesca.p":
        "Dedica una jornada a la pesca y disfruta la tranquilidad de la laguna. Consulta equipos, modalidades y tarifas.",
      "exp.senderismo.h": "Senderismo",
      "exp.senderismo.p":
        "Recorre los senderos y descubre el paisaje a tu ritmo. Consulta las rutas y recomendaciones para tu visita.",
      "exp.botes.h": "Botes a remo",
      "exp.botes.p":
        "Vive la laguna desde el agua con un paseo en bote. Consulta disponibilidad y condiciones del servicio.",
      "exp.juegos.h": "Juegos infantiles",
      "exp.juegos.p":
        "Un espacio de entretenimiento para los más pequeños, para compartir el paseo en familia.",
      "exp.rest.h": "Restaurante AYLLU",
      "exp.rest.p":
        "Haz una pausa para comer y compartir. Consulta la carta y los horarios del restaurante y la cafetería.",
      "exp.park.h": "Parqueadero",
      "exp.park.p":
        "Contamos con espacio para estacionar durante tu visita. Consulta disponibilidad y condiciones de acceso.",
      "exp.glamp.h": "Glamping",
      "exp.glamp.p":
        "Quédate un poco más y disfruta una estancia en la naturaleza. Consulta opciones, servicios incluidos y fechas disponibles.",
      "exp.more": "Conoce más",
      "rest.kicker": "RESTAURANTE & CAFETERÍA",
      "rest.place": "LAGUNA TIPOPUGRO",
      "rest.brandP": "El paseo también<br>se disfruta a la mesa.",
      "rest.eyebrow": "UN BUEN MOTIVO PARA REUNIRSE",
      "rest.title": "El sabor de compartir.<br><em>La esencia de AYLLU.</em>",
      "rest.body":
        "Antes de explorar o después de una tarde de pesca, haz una pausa en AYLLU. Un espacio para sentarse, conversar y compartir la visita alrededor de la mesa.",
      "rest.cta": "Consulta la carta y horarios ↗",
      "rest.note": "Conoce las novedades del restaurante en nuestra página de Facebook.",
      "out.photo": "EL PLAN ESTÁ AFUERA.",
      "out.alt": "Entorno natural de Laguna Tipopugro",
      "out.eyebrow": "PESCA & NATURALEZA",
      "out.title": "Sal de la rutina.<br><em>Entra en la naturaleza.</em>",
      "out.pesca.h": "Pesca en la laguna",
      "out.pesca.p":
        "Disfruta una jornada a tu ritmo. Consulta modalidades, equipos, tarifas y condiciones antes de venir.",
      "out.nature.h": "Tiempo en la naturaleza",
      "out.nature.p":
        "Disfruta el paisaje y comparte un día al aire libre. Pregúntanos por las actividades disponibles para tu visita.",
      "out.cta": "Ver fechas para pesca ↗",
      "glamp.eyebrow": "QUE EL PLAN NO TERMINE TAN PRONTO",
      "glamp.title": "Descansa junto a la laguna.",
      "glamp.h": "Descubre el glamping",
      "glamp.p":
        "Combina tu visita a la laguna con una estancia en la naturaleza. Consulta las opciones de alojamiento, qué incluyen y la disponibilidad para tus fechas.",
      "glamp.cta": "Ver disponibilidad ↗",
      "book.eyebrow": "RESERVA TU EXPERIENCIA",
      "book.title": "Elige tu día.<br><em>Encuentra tu lugar.</em>",
      "book.lead":
        "Consulta fechas y cupos, elige tu opción y revisa los detalles de tu visita sin salir de la página.",
      "book.noscript":
        'Activa JavaScript para explorar el calendario de demostración, o <a href="https://www.facebook.com/lagunatipopugro/">consulta directamente con AYLLU</a>.',
      "foot.list":
        "Restaurante AYLLU · Pesca · Senderismo · Botes a remo · Juegos infantiles · Parqueadero · Glamping",
      "foot.photo": "Fotografía de Laguna Tipopugro:",
      "slide.0.k": "AYLLU · LAGUNA TIPOPUGRO",
      "slide.0.t": "Hay lugares que se visitan.\nY otros que se viven.",
      "slide.0.d":
        "Gastronomía en AYLLU, pesca y glamping.\nEncuentra tu próxima experiencia en la naturaleza.",
      "slide.0.a": "Explora nuestras experiencias",
      "slide.1.k": "AYLLU · RESTAURANTE & CAFETERÍA",
      "slide.1.t": "Una buena mesa.\nUn gran momento para compartir.",
      "slide.1.d":
        "Haz una pausa en AYLLU y disfruta el encuentro.\nLa gastronomía también es parte de tu escapada.",
      "slide.1.a": "Descubre AYLLU",
      "slide.2.k": "PESCA · LAGUNA TIPOPUGRO",
      "slide.2.t": "Cambia la rutina\npor una tarde de pesca.",
      "slide.2.d": "Tómate tu tiempo, disfruta el paisaje\ny vive la laguna a tu manera.",
      "slide.2.a": "Conoce la experiencia",
      "slide.3.k": "GLAMPING · NATURALEZA",
      "slide.3.t": "Que tu escapada\ndure un poco más.",
      "slide.3.d":
        "Descubre las opciones de alojamiento\ny planea tu estancia en la naturaleza.",
      "slide.3.a": "Consulta el glamping",
      "svc.glamping.name": "Glamping",
      "svc.glamping.subtitle": "Una estancia en la naturaleza",
      "svc.glamping.unit": "glamping",
      "svc.glamping.plural": "glampings",
      "svc.glamping.note":
        "Ejemplo: 2 personas por glamping, entrada 15:00 y salida 11:00.",
      "svc.restaurante.name": "Restaurante AYLLU",
      "svc.restaurante.subtitle": "Una mesa para compartir",
      "svc.restaurante.unit": "plaza",
      "svc.restaurante.plural": "plazas",
      "svc.restaurante.note":
        "Ejemplo: mesas por horario. Carta y precios por confirmar con AYLLU.",
      "svc.pesca.name": "Pesca en el lago",
      "svc.pesca.subtitle": "Disfruta la laguna a tu ritmo",
      "svc.pesca.unit": "plaza",
      "svc.pesca.plural": "plazas",
      "svc.pesca.note": "Ejemplo: plazas por turno. Equipos y condiciones por confirmar.",
      "svc.botes.name": "Botes a remo",
      "svc.botes.subtitle": "Otra forma de descubrir el paisaje",
      "svc.botes.unit": "bote",
      "svc.botes.plural": "botes",
      "svc.botes.note":
        "Ejemplo: 3 personas por bote. Capacidad y duración reales por confirmar.",
      "svc.senderismo.name": "Senderismo",
      "svc.senderismo.subtitle": "Un recorrido al aire libre",
      "svc.senderismo.unit": "plaza",
      "svc.senderismo.plural": "plazas",
      "svc.senderismo.note": "Ejemplo: cupos por salida. Ruta y condiciones por confirmar.",
      "extra.juegos": "Juegos infantiles",
      "extra.parqueadero": "Parqueadero",
      "av.pick": "Selecciona una experiencia.",
      "av.date": "Elige una fecha válida.",
      "av.fromToday": "Selecciona una fecha de hoy en adelante.",
      "av.horizon": "La demostración muestra los próximos 90 días.",
      "av.guests": "Esta demo admite entre 1 y {max} personas para {name}.",
      "av.nights": "Elige entre 1 y 7 noches para probar la estancia.",
      "av.stayOver": "La estancia supera las fechas disponibles en esta demostración.",
      "av.gone": "La opción ya no tiene cupo para tu grupo. Elige otra fecha u horario.",
      "bk.demo": "VISTA DE DEMOSTRACIÓN",
      "bk.demoP":
        "Fechas, horarios y cupos de ejemplo. Aún no están conectados con la agenda de AYLLU.",
      "bk.step1": "Experiencia",
      "bk.step2": "Disponibilidad",
      "bk.step3": "Revisión",
      "bk.steps": "Pasos de la reserva",
      "bk.s01": "PASO 01",
      "bk.s02": "PASO 02",
      "bk.s03": "PASO 03",
      "bk.q1": "¿Qué te gustaría reservar?",
      "bk.q1p": "Selecciona una experiencia y el tamaño de tu grupo.",
      "bk.group": "Experiencia a reservar",
      "bk.guests": "Personas",
      "bk.guestsHint": "Incluye a todas las personas del grupo",
      "bk.less": "Quitar una persona",
      "bk.more": "Añadir una persona",
      "bk.cap": "Capacidad de prueba: hasta {max} personas por consulta.",
      "bk.extraTitle": "Completa el paseo",
      "bk.extraP":
        "También puedes consultar por juegos infantiles y parqueadero al revisar tu selección.",
      "bk.nextHint": "En el siguiente paso verás fechas y cupos.",
      "bk.next": "Ver disponibilidad",
      "bk.find": "Encuentra tu fecha.",
      "bk.findP": "Los cupos se actualizan al cambiar tus fechas o el tamaño del grupo.",
      "bk.arrival": "Fecha de llegada",
      "bk.visit": "Fecha de visita",
      "bk.nights": "Noches",
      "bk.night1": "noche",
      "bk.nightN": "noches",
      "bk.person1": "persona",
      "bk.personN": "personas",
      "bk.prevMonth": "Mes anterior",
      "bk.nextMonth": "Mes siguiente",
      "bk.legOk": "Disponible",
      "bk.legLow": "Pocos cupos",
      "bk.legFull": "Sin cupo",
      "bk.legOut": "Fuera de rango",
      "bk.calMeta": "El calendario considera {guests} {who}{stay}. Inventario de ejemplo.",
      "bk.andStay": " y {n} {nights}",
      "bk.exData": "Datos de ejemplo.",
      "bk.stayAvail": "Disponibilidad de la estancia",
      "bk.pickTime": "Elige un horario",
      "bk.ecTime": "Hora de Ecuador · Cupos de demostración",
      "bk.badDate": "Revisa la fecha seleccionada",
      "bk.noGroup": "No hay cupo de ejemplo para tu grupo.",
      "bk.tryOther": "Prueba otra fecha o ajusta el número de personas.",
      "bk.otherDates": "Otras fechas con disponibilidad:",
      "bk.seeSlots": "Ver cupos →",
      "bk.stayFor": "Estancia para {n} {who}",
      "bk.freeStay": "{units} libres durante toda la estancia",
      "bk.checkInOut": "Entrada 15:00 · Salida 11:00 (horarios de ejemplo)",
      "bk.times": "Horarios de ejemplo",
      "bk.past": "Horario pasado",
      "bk.noSlot": "Sin cupo para tu grupo",
      "bk.unitsFree": "{units} disponibles",
      "bk.backExp": "← Cambiar experiencia",
      "bk.reviewCta": "Revisar selección",
      "bk.review": "Revisa tu visita.",
      "bk.reviewP": "Estos son los detalles de la opción que seleccionaste.",
      "bk.demoOk": "Cupo disponible en la demostración",
      "bk.checkAvail": "Revisa la disponibilidad",
      "bk.moreQ": "¿Te interesa algo más?",
      "bk.moreP": "Agregaremos estas opciones a tu consulta, sin confirmar cupos.",
      "bk.warn": "Estás probando el proceso de reserva.",
      "bk.warnP":
        "La disponibilidad es ficticia. Al terminar se descontarán cupos solo en esta sesión de prueba; no se enviará una reserva a AYLLU.",
      "bk.backDate": "← Cambiar fecha u horario",
      "bk.simulate": "Simular reserva",
      "bk.done": "DEMOSTRACIÓN COMPLETADA",
      "bk.ready": "Tu reserva de prueba está lista.",
      "bk.notReal": "No es una reserva real. Para confirmar una visita, comunícate con AYLLU.",
      "bk.also": "También te interesa: {list}. Por consultar.",
      "bk.resetHint":
        "El inventario de prueba se actualizó para esta sesión. Al recargar se restablecerá.",
      "bk.again": "Probar otra reserva",
      "bk.contact": "Contactar con AYLLU ↗",
      "bk.yourVisit": "TU VISITA A AYLLU",
      "bk.arrivalDt": "Llegada",
      "bk.dateDt": "Fecha",
      "bk.outDt": "Salida",
      "bk.stayDt": "Estancia",
      "bk.timeDt": "Horario",
      "bk.pickLater": "Por elegir",
      "bk.checkin": "Entrada",
      "bk.quotaOk": "Hay cupo de ejemplo para tu grupo",
      "bk.fixDates": "Revisa tus fechas",
      "bk.pickOpt": "Selecciona una opción",
      "bk.simAvail": "Disponibilidad simulada",
      "bk.rate": "Tarifa por confirmar",
      "bk.noCharge": "No se realizan cobros en esta demostración.",
      "bk.changeHint": "Puedes cambiar de fecha o de experiencia antes de terminar.",
      "bk.invalidDate": "Selecciona una fecha válida.",
      "bk.guestRange": "Selecciona entre 1 y {max} personas.",
      "bk.wd.mon": "Lunes",
      "bk.wd.tue": "Martes",
      "bk.wd.wed": "Miércoles",
      "bk.wd.thu": "Jueves",
      "bk.wd.fri": "Viernes",
      "bk.wd.sat": "Sábado",
      "bk.wd.sun": "Domingo",
      "bk.wdShort": "L,M,X,J,V,S,D",
      "bk.annDate": "{date}. {status}. Disponibilidad de ejemplo.",
      "bk.annTime": "Horario {time} seleccionado.",
      "bk.annOk": "Reserva de demostración creada. No se ha enviado ninguna reserva real.",
    },
    en: {
      "meta.title": "AYLLU · Restaurant, fishing and glamping",
      "meta.description":
        "Discover AYLLU at Tipopugro Lagoon. Food, fishing, glamping and nature to share.",
      "nav.brandSub": "RESTAURANT · FISHING · GLAMPING",
      "nav.menu": "Menu",
      "nav.menuOpen": "Open menu",
      "nav.menuClose": "Close menu",
      "nav.experiences": "Experiences",
      "nav.restaurant": "AYLLU Restaurant",
      "nav.glamping": "Glamping",
      "nav.panel": "Panel",
      "nav.cta": "Check availability ↗",
      "nav.lang": "Language",
      "guard.translate": "Your browser translator is changing this page. Turn it off (Google Translate icon) to see AYLLU in the language you chose.",
      "guard.close": "Dismiss notice",
      "hero.alt": "Tipopugro Lagoon surrounded by mountains",
      "hero.prev": "Previous experience",
      "hero.next": "Next experience",
      "hero.discover": "DISCOVER AYLLU",
      "hero.place": "NATURE THAT CONNECTS",
      "hero.carousel": "Discover AYLLU",
      "strip.restaurant": "AYLLU Restaurant",
      "strip.fishing": "Fishing",
      "strip.glamping": "Glamping",
      "strip.nature": "Nature",
      "exp.eyebrow": "AYLLU SERVICES AND EXPERIENCES",
      "exp.title": "Everything you need<br><em>for your visit.</em>",
      "exp.lead":
        "Food, outdoor activities and rest in one place. Choose how you want to live AYLLU.",
      "exp.pesca.h": "Lake fishing",
      "exp.pesca.p":
        "Spend a day fishing and enjoy the quiet of the lagoon. Ask about gear, formats and rates.",
      "exp.senderismo.h": "Hiking",
      "exp.senderismo.p":
        "Walk the trails and take in the landscape at your pace. Ask about routes and tips for your visit.",
      "exp.botes.h": "Rowboats",
      "exp.botes.p":
        "See the lagoon from the water. Check availability and conditions for the boat ride.",
      "exp.juegos.h": "Kids' play area",
      "exp.juegos.p": "A play space for the little ones, so the outing works for the whole family.",
      "exp.rest.h": "AYLLU Restaurant",
      "exp.rest.p":
        "Pause to eat and share. Ask about the menu and hours for the restaurant and café.",
      "exp.park.h": "Parking",
      "exp.park.p":
        "There is space to park during your visit. Ask about availability and access.",
      "exp.glamp.h": "Glamping",
      "exp.glamp.p":
        "Stay a little longer and rest in nature. Ask about options, what's included and open dates.",
      "exp.more": "Learn more",
      "rest.kicker": "RESTAURANT & CAFÉ",
      "rest.place": "TIPOPUGRO LAGOON",
      "rest.brandP": "The outing is also<br>enjoyed at the table.",
      "rest.eyebrow": "A GOOD REASON TO GATHER",
      "rest.title": "The taste of sharing.<br><em>The essence of AYLLU.</em>",
      "rest.body":
        "Before you explore or after an afternoon of fishing, pause at AYLLU. A place to sit, talk and share the visit around the table.",
      "rest.cta": "See the menu and hours ↗",
      "rest.note": "Follow restaurant updates on our Facebook page.",
      "out.photo": "THE PLAN IS OUTSIDE.",
      "out.alt": "Natural setting of Tipopugro Lagoon",
      "out.eyebrow": "FISHING & NATURE",
      "out.title": "Leave the routine.<br><em>Step into nature.</em>",
      "out.pesca.h": "Fishing on the lagoon",
      "out.pesca.p":
        "Enjoy the day at your own pace. Check formats, gear, rates and conditions before you come.",
      "out.nature.h": "Time in nature",
      "out.nature.p":
        "Enjoy the landscape and share a day outdoors. Ask us what is available for your visit.",
      "out.cta": "See fishing dates ↗",
      "glamp.eyebrow": "LET THE PLAN LAST A LITTLE LONGER",
      "glamp.title": "Rest by the lagoon.",
      "glamp.h": "Discover the glamping",
      "glamp.p":
        "Pair your lagoon visit with a stay in nature. Check lodging options, what's included and dates.",
      "glamp.cta": "See availability ↗",
      "book.eyebrow": "BOOK YOUR EXPERIENCE",
      "book.title": "Pick your day.<br><em>Find your place.</em>",
      "book.lead":
        "Check dates and spots, choose an option and review your visit without leaving the page.",
      "book.noscript":
        'Turn on JavaScript to explore the demo calendar, or <a href="https://www.facebook.com/lagunatipopugro/">contact AYLLU directly</a>.',
      "foot.list":
        "AYLLU Restaurant · Fishing · Hiking · Rowboats · Kids' play area · Parking · Glamping",
      "foot.photo": "Tipopugro Lagoon photograph:",
      "slide.0.k": "AYLLU · TIPOPUGRO LAGOON",
      "slide.0.t": "Some places are visited.\nOthers are lived.",
      "slide.0.d":
        "Food at AYLLU, fishing and glamping.\nFind your next experience in nature.",
      "slide.0.a": "Explore our experiences",
      "slide.1.k": "AYLLU · RESTAURANT & CAFÉ",
      "slide.1.t": "A good table.\nA great moment to share.",
      "slide.1.d":
        "Pause at AYLLU and enjoy the gathering.\nThe food is part of your getaway too.",
      "slide.1.a": "Discover AYLLU",
      "slide.2.k": "FISHING · TIPOPUGRO LAGOON",
      "slide.2.t": "Trade the routine\nfor an afternoon of fishing.",
      "slide.2.d": "Take your time, enjoy the landscape\nand live the lagoon your way.",
      "slide.2.a": "See the experience",
      "slide.3.k": "GLAMPING · NATURE",
      "slide.3.t": "Let your getaway\nlast a little longer.",
      "slide.3.d": "See lodging options\nand plan your stay in nature.",
      "slide.3.a": "Check the glamping",
      "svc.glamping.name": "Glamping",
      "svc.glamping.subtitle": "A stay in nature",
      "svc.glamping.unit": "glamping",
      "svc.glamping.plural": "glampings",
      "svc.glamping.note": "Example: 2 people per glamping, check-in 3:00 p.m., check-out 11:00 a.m.",
      "svc.restaurante.name": "AYLLU Restaurant",
      "svc.restaurante.subtitle": "A table to share",
      "svc.restaurante.unit": "seat",
      "svc.restaurante.plural": "seats",
      "svc.restaurante.note":
        "Example: tables by time slot. Menu and prices to confirm with AYLLU.",
      "svc.pesca.name": "Lake fishing",
      "svc.pesca.subtitle": "Enjoy the lagoon at your pace",
      "svc.pesca.unit": "spot",
      "svc.pesca.plural": "spots",
      "svc.pesca.note": "Example: spots per shift. Gear and conditions to confirm.",
      "svc.botes.name": "Rowboats",
      "svc.botes.subtitle": "Another way to see the landscape",
      "svc.botes.unit": "boat",
      "svc.botes.plural": "boats",
      "svc.botes.note": "Example: 3 people per boat. Real capacity and length to confirm.",
      "svc.senderismo.name": "Hiking",
      "svc.senderismo.subtitle": "An outdoor walk",
      "svc.senderismo.unit": "spot",
      "svc.senderismo.plural": "spots",
      "svc.senderismo.note": "Example: spots per departure. Route and conditions to confirm.",
      "extra.juegos": "Kids' play area",
      "extra.parqueadero": "Parking",
      "av.pick": "Choose an experience.",
      "av.date": "Pick a valid date.",
      "av.fromToday": "Choose a date from today onward.",
      "av.horizon": "This demo shows the next 90 days.",
      "av.guests": "This demo allows 1 to {max} people for {name}.",
      "av.nights": "Choose 1 to 7 nights to try the stay.",
      "av.stayOver": "The stay goes past the dates available in this demo.",
      "av.gone": "That option no longer has space for your group. Pick another date or time.",
      "bk.demo": "DEMO VIEW",
      "bk.demoP":
        "Sample dates, times and spots. They are not yet linked to AYLLU's real calendar.",
      "bk.step1": "Experience",
      "bk.step2": "Availability",
      "bk.step3": "Review",
      "bk.steps": "Booking steps",
      "bk.s01": "STEP 01",
      "bk.s02": "STEP 02",
      "bk.s03": "STEP 03",
      "bk.q1": "What would you like to book?",
      "bk.q1p": "Choose an experience and the size of your group.",
      "bk.group": "Experience to book",
      "bk.guests": "Guests",
      "bk.guestsHint": "Include everyone in the group",
      "bk.less": "Remove one guest",
      "bk.more": "Add one guest",
      "bk.cap": "Trial capacity: up to {max} people per query.",
      "bk.extraTitle": "Round out the outing",
      "bk.extraP": "You can also ask about the kids' play area and parking when you review.",
      "bk.nextHint": "Next you'll see dates and spots.",
      "bk.next": "See availability",
      "bk.find": "Find your date.",
      "bk.findP": "Spots update when you change dates or group size.",
      "bk.arrival": "Arrival date",
      "bk.visit": "Visit date",
      "bk.nights": "Nights",
      "bk.night1": "night",
      "bk.nightN": "nights",
      "bk.person1": "person",
      "bk.personN": "people",
      "bk.prevMonth": "Previous month",
      "bk.nextMonth": "Next month",
      "bk.legOk": "Available",
      "bk.legLow": "Few spots",
      "bk.legFull": "Full",
      "bk.legOut": "Out of range",
      "bk.calMeta": "The calendar is for {guests} {who}{stay}. Sample inventory.",
      "bk.andStay": " and {n} {nights}",
      "bk.exData": "Sample data.",
      "bk.stayAvail": "Stay availability",
      "bk.pickTime": "Choose a time",
      "bk.ecTime": "Ecuador time · Demo spots",
      "bk.badDate": "Check the selected date",
      "bk.noGroup": "No sample space for your group.",
      "bk.tryOther": "Try another date or change the group size.",
      "bk.otherDates": "Other dates with space:",
      "bk.seeSlots": "See spots →",
      "bk.stayFor": "Stay for {n} {who}",
      "bk.freeStay": "{units} free for the whole stay",
      "bk.checkInOut": "Check-in 3:00 p.m. · Check-out 11:00 a.m. (sample times)",
      "bk.times": "Sample times",
      "bk.past": "Time has passed",
      "bk.noSlot": "No space for your group",
      "bk.unitsFree": "{units} available",
      "bk.backExp": "← Change experience",
      "bk.reviewCta": "Review selection",
      "bk.review": "Review your visit.",
      "bk.reviewP": "These are the details of the option you selected.",
      "bk.demoOk": "Space available in the demo",
      "bk.checkAvail": "Check availability",
      "bk.moreQ": "Anything else?",
      "bk.moreP": "We'll add these to your inquiry, without confirming spots.",
      "bk.warn": "You are trying the booking process.",
      "bk.warnP":
        "Availability is fictional. Finishing will only reduce spots in this trial session; no booking is sent to AYLLU.",
      "bk.backDate": "← Change date or time",
      "bk.simulate": "Simulate booking",
      "bk.done": "DEMO COMPLETE",
      "bk.ready": "Your trial booking is ready.",
      "bk.notReal": "This is not a real booking. To confirm a visit, contact AYLLU.",
      "bk.also": "You are also interested in: {list}. To confirm.",
      "bk.resetHint": "The trial inventory updated for this session. Reloading resets it.",
      "bk.again": "Try another booking",
      "bk.contact": "Contact AYLLU ↗",
      "bk.yourVisit": "YOUR VISIT TO AYLLU",
      "bk.arrivalDt": "Arrival",
      "bk.dateDt": "Date",
      "bk.outDt": "Departure",
      "bk.stayDt": "Stay",
      "bk.timeDt": "Time",
      "bk.pickLater": "To choose",
      "bk.checkin": "Check-in",
      "bk.quotaOk": "There is sample space for your group",
      "bk.fixDates": "Check your dates",
      "bk.pickOpt": "Select an option",
      "bk.simAvail": "Simulated availability",
      "bk.rate": "Rate to confirm",
      "bk.noCharge": "No charges are taken in this demo.",
      "bk.changeHint": "You can change the date or experience before you finish.",
      "bk.invalidDate": "Pick a valid date.",
      "bk.guestRange": "Choose between 1 and {max} people.",
      "bk.wd.mon": "Monday",
      "bk.wd.tue": "Tuesday",
      "bk.wd.wed": "Wednesday",
      "bk.wd.thu": "Thursday",
      "bk.wd.fri": "Friday",
      "bk.wd.sat": "Saturday",
      "bk.wd.sun": "Sunday",
      "bk.wdShort": "M,T,W,T,F,S,S",
      "bk.annDate": "{date}. {status}. Sample availability.",
      "bk.annTime": "Time {time} selected.",
      "bk.annOk": "Demo booking created. No real booking was sent.",
    },
  };

  let lang = "es";

  function t(key, vars) {
    let s = dict[lang]?.[key] ?? dict.es[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  }

  function locale() {
    return lang === "en" ? "en-US" : "es-EC";
  }

  function applyServices() {
    const S = window.AylluAvailability?.SERVICES;
    if (!S) return;
    for (const id of Object.keys(S)) {
      S[id].name = t(`svc.${id}.name`);
      S[id].subtitle = t(`svc.${id}.subtitle`);
      S[id].unit = t(`svc.${id}.unit`);
      S[id].plural = t(`svc.${id}.plural`);
      S[id].note = t(`svc.${id}.note`);
    }
  }

  function lockPage() {
    const root = document.documentElement;
    root.classList.add("notranslate");
    root.classList.remove("translated-ltr", "translated-rtl");
    root.setAttribute("translate", "no");
    root.lang = lang;
    document.body?.classList.add("notranslate");
    document.body?.setAttribute("translate", "no");
  }

  function applyDom() {
    lockPage();
    document.title = t("meta.title");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("meta.description"));
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const html = t(key);
      if (!html || html === key) return;
      const attr = el.getAttribute("data-i18n-attr");
      try {
        if (attr) el.setAttribute(attr, html.replace(/<[^>]+>/g, ""));
        else el.innerHTML = html;
      } catch {
        el.textContent = html.replace(/<[^>]+>/g, "");
      }
    });
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang") === lang));
    });
    applyServices();
  }

  function setLang(next, { syncUrl = true } = {}) {
    lang = langs.includes(next) ? next : "es";
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
    if (syncUrl) {
      const url = new URL(location.href);
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    }
    applyDom();
    window.dispatchEvent(new CustomEvent("ayllu:lang", { detail: lang }));
  }

  function fromBrowser() {
    const list = [...(navigator.languages || []), navigator.language].filter(Boolean);
    for (const raw of list) {
      const code = String(raw).toLowerCase();
      if (code.startsWith("en")) return "en";
      if (code.startsWith("es")) return "es";
    }
    return "es";
  }

  function detect() {
    const q = new URLSearchParams(location.search).get("lang");
    if (langs.includes(q)) return q;
    try {
      const saved = localStorage.getItem(KEY);
      if (langs.includes(saved)) return saved;
    } catch {
      /* ignore */
    }
    return fromBrowser();
  }

  function showTranslateGuard() {
    const box = document.querySelector("#translate-guard");
    if (!box) return;
    box.hidden = false;
  }

  function hideTranslateGuard() {
    const box = document.querySelector("#translate-guard");
    if (box) box.hidden = true;
  }

  function pageWasTranslated() {
    const root = document.documentElement;
    return (
      root.classList.contains("translated-ltr") ||
      root.classList.contains("translated-rtl") ||
      Boolean(document.querySelector('font[style*="vertical-align"]'))
    );
  }

  function watchBrowserTranslate() {
    let restoring = false;
    let hits = 0;
    const restore = () => {
      if (restoring || !pageWasTranslated()) return;
      if (hits >= 12) {
        showTranslateGuard();
        return;
      }
      restoring = true;
      hits += 1;
      applyDom();
      window.dispatchEvent(new CustomEvent("ayllu:lang", { detail: lang }));
      showTranslateGuard();
      setTimeout(() => {
        restoring = false;
      }, 80);
    };
    const obs = new MutationObserver(() => restore());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "lang"] });
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    }
    document.querySelector("#translate-guard-close")?.addEventListener("click", hideTranslateGuard);
  }

  function init() {
    try {
      lang = detect();
      applyDom();
      watchBrowserTranslate();
      document.querySelector(".lang-switch")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-lang]");
        if (btn) setLang(btn.getAttribute("data-lang"));
      });
    } catch (err) {
      console.warn("AYLLU i18n:", err);
    }
  }

  return { t, setLang, getLang: () => lang, locale, langs, init, applyServices };
})();

if (typeof window !== "undefined") window.AylluI18n = AylluI18n;
AylluI18n.init();
