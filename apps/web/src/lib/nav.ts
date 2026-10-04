export type NavLink = {
  href: string;
  label: string;
  hint?: string;
  icon: string;
};

export type NavGroup = {
  id: string;
  title: string;
  blurb: string;
  links: NavLink[];
};

export const RESERVAS_GROUP: NavGroup = {
  id: "reservas",
  title: "Principal",
  blurb: "Tus reservas y actividades, en un solo lugar.",
  links: [{ href: "/bookings", label: "Agenda", icon: "calendar" }],
};

export const PLATAFORMA_GROUP: NavGroup = {
  id: "plataforma",
  title: "Más",
  blurb: "Activación manual de extras por plan",
  links: [{ href: "/admin", label: "Planes", icon: "shield" }],
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "principal",
    title: "Principal",
    blurb: "Tu negocio, de un vistazo.",
    links: [
      { href: "/dashboard", label: "Inicio", icon: "home" },
      { href: "/inbox", label: "Bandeja de entrada", icon: "inbox" },
      { href: "/contacts", label: "CRM", icon: "kanban" },
      { href: "/products", label: "Productos", icon: "box" },
    ],
  },
  {
    id: "asistente",
    title: "Asistente",
    blurb: "Cómo responde el bot",
    links: [
      { href: "/knowledge", label: "Conocimiento", icon: "book" },
      { href: "/rules", label: "Reglas del bot", icon: "sliders" },
      { href: "/channels", label: "Canales", icon: "radio" },
      { href: "/flows", label: "Flujos", icon: "wand" },
      { href: "/payments", label: "Pagos", icon: "card" },
    ],
  },
  {
    id: "mas",
    title: "Más",
    blurb: "El resto del espacio de trabajo",
    links: [
      { href: "/alerts", label: "Alertas", icon: "bell" },
      { href: "/services", label: "Servicios", icon: "spark" },
      { href: "/promotions", label: "Promociones", icon: "tag" },
      { href: "/tags", label: "Etiquetas", icon: "tag" },
      { href: "/replies", label: "Respuestas", icon: "chat" },
    ],
  },
];

export function visibleNavGroups(opts: {
  bookingsEnabled?: boolean;
  isPlatformAdmin?: boolean;
}): NavGroup[] {
  const groups = NAV_GROUPS.map((g) => ({ ...g, links: [...g.links] }));
  const principal = groups.find((g) => g.id === "principal");
  if (opts.bookingsEnabled && principal && !principal.links.some((l) => l.href === "/bookings")) {
    principal.links.push({ href: "/bookings", label: "Agenda", icon: "calendar" });
  }
  if (opts.isPlatformAdmin) {
    const extra = groups.find((g) => g.id === "mas");
    extra?.links.push({ href: "/audit", label: "Auditoría", icon: "list" });
    extra?.links.push({ href: "/admin", label: "Planes", icon: "shield" });
  }
  return groups;
}

export function groupForPath(path: string): NavGroup | undefined {
  if (path === "/settings") {
    return { id: "config", title: "Espacio de trabajo", blurb: "", links: [{ href: "/settings", label: "Configuración", icon: "gear" }] };
  }
  return visibleNavGroups({ bookingsEnabled: true, isPlatformAdmin: true }).find((g) =>
    g.links.some((l) => l.href === path),
  );
}

export const PAGE_COPY: Record<string, { title: string; lead: string }> = {
  "/inbox": { title: "Bandeja de entrada", lead: "Los chats de WhatsApp. Cada hilo usa el flujo del canal." },
  "/contacts": {
    title: "CRM",
    lead: "Sigue a cada persona desde el primer WhatsApp hasta la reserva.",
  },
  "/channels": {
    title: "Canales",
    lead: "Conecta WhatsApp y elige el flujo que responde en cada número.",
  },
  "/flows": {
    title: "Flujos de atención",
    lead: "Organiza la instrucción, los canales y las reglas de tu asistente.",
  },
  "/alerts": { title: "Alertas", lead: "Avisos que el bot no puede cerrar solo: horario, asesor o sin respuesta." },
  "/dashboard": {
    title: "Panel de control",
    lead: "Revisa tus conversaciones y atiende lo que necesita tu equipo.",
  },
  "/products": { title: "Productos", lead: "Organiza el catálogo que tu asistente comparte con tus clientes." },
  "/services": {
    title: "Servicios",
    lead: "Administra las experiencias que tu asistente puede ofrecer.",
  },
  "/promotions": { title: "Promociones", lead: "Administra las ofertas que tu asistente puede recomendar." },
  "/tags": {
    title: "Etiquetas",
    lead: "Organiza tus contactos con etiquetas fáciles de identificar.",
  },
  "/knowledge": {
    title: "Conocimiento",
    lead: "Un tema por documento. El asistente usa solo lo que pregunta el cliente.",
  },
  "/rules": {
    title: "Reglas del bot",
    lead: "Define cómo decide y actúa tu asistente.",
  },
  "/replies": {
    title: "Respuestas guardadas",
    lead: "Organiza las plantillas que tu equipo utiliza desde la bandeja.",
  },
  "/settings": { title: "Configuración", lead: "WhatsApp, tono del bot y el mapa del lugar." },
  "/payments": {
    title: "Métodos de pago",
    lead: "Administra las opciones que tu asistente comparte por WhatsApp.",
  },
  "/audit": { title: "Auditoría", lead: "Quién cambió qué en esta empresa." },
  "/bookings": {
    title: "Agenda",
    lead: "Tus reservas y actividades, en un solo lugar.",
  },
  "/floor": {
    title: "Piso",
    lead: "Reservas manuales del día: quien llama o llega al local.",
  },
  "/admin": {
    title: "Planes y módulos",
    lead: "Administra los módulos contratados y quién entra a cada empresa.",
  },
};
