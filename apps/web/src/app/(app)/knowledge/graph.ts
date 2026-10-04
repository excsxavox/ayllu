export type NodeKind = "hub" | "topic" | "doc";

export type KnowNode = {
  id: string;
  kind: NodeKind;
  label: string;
  icon: string;
  parentId?: string;
  content?: string;
  sourceType?: string;
  docId?: string;
  related?: string[];
  demo?: boolean;
  catalogKind?: "service";
  catalogId?: string;
};

export type KnowEdge = { from: string; to: string };

export type Graph = { nodes: KnowNode[]; edges: KnowEdge[] };

export type Point = { x: number; y: number };

type Doc = {
  id: string;
  title: string;
  content: string;
  sourceType: string;
};

type Service = { id: string; name: string; description?: string | null; isActive: boolean };

export function sampleGraph(companyName: string): Graph {
  const hub = companyName.trim() || "Ayllu";
  const nodes: KnowNode[] = [
    { id: "hub", kind: "hub", label: `Asistente ${hub}`, icon: "bot" },
    {
      id: "faq",
      kind: "doc",
      parentId: "hub",
      label: "Preguntas frecuentes",
      icon: "file",
      sourceType: "FAQ",
      demo: true,
      related: ["Servicios", "Reservas", "Ubicación"],
      content:
        "El asistente de WhatsApp de Ayllu atiende las 24 horas.\n\nAyllu es una reserva junto al lago. Ofrece glamping, acampar, pesca, botes a remo, senderos, juegos, restaurante y parqueo.",
    },
    { id: "horarios", kind: "doc", parentId: "faq", label: "Horarios", icon: "clock", demo: true, content: "Atendemos todos los días. El asistente responde a cualquier hora." },
    { id: "normas", kind: "doc", parentId: "faq", label: "Normas", icon: "shield", demo: true, content: "Cuidamos el lago. No se deja basura y se respeta el descanso de los demás." },
    { id: "llegar", kind: "doc", parentId: "faq", label: "Cómo llegar", icon: "map", demo: true, content: "Te compartimos la ubicación y cómo llegar al lago." },
    { id: "ubicacion", kind: "doc", parentId: "faq", label: "Ubicación", icon: "map", demo: true, content: "Estamos junto al lago. Pide el mapa al asistente." },
    { id: "parqueo", kind: "doc", parentId: "faq", label: "Parqueo", icon: "building", demo: true, content: "Hay parqueo en el lugar." },
    { id: "servicios", kind: "topic", parentId: "hub", label: "Servicios", icon: "sliders", related: ["Reservas", "Preguntas frecuentes"] },
    { id: "acamp", kind: "doc", parentId: "servicios", label: "Acampar", icon: "tent", demo: true, content: "Reserva para acampar. La tienda es un complemento con stock limitado." },
    { id: "glamp", kind: "doc", parentId: "servicios", label: "Glamping", icon: "home", demo: true, content: "Domos junto al lago. Se reserva por unidad." },
    { id: "rest", kind: "doc", parentId: "servicios", label: "Restaurante", icon: "utensils", demo: true, content: "Mesas en el restaurante del lago." },
    { id: "reservas", kind: "topic", parentId: "hub", label: "Reservas", icon: "calendar", related: ["Servicios", "Pagos"] },
    { id: "disp", kind: "doc", parentId: "reservas", label: "Disponibilidad", icon: "calendar", demo: true, content: "El asistente consulta horarios libres y te ayuda a reservar." },
    { id: "pagos", kind: "doc", parentId: "reservas", label: "Pagos", icon: "card", demo: true, content: "Puedes pagar por transferencia. El asistente comparte las cuentas activas." },
  ];
  return { nodes, edges: edgesOf(nodes) };
}

export function buildGraph(docs: Doc[] | null, services: Service[] | null, companyName: string, bookingsEnabled?: boolean): Graph {
  const hubLabel = `Asistente ${(companyName || "Ayllu").trim()}`;
  const nodes: KnowNode[] = [{ id: "hub", kind: "hub", label: hubLabel, icon: "bot" }];
  const written = (docs ?? []).filter((d) => d.sourceType !== "CATALOG");
  const faqs = written.filter((d) => d.sourceType === "FAQ");
  const manuals = written.filter((d) => d.sourceType !== "FAQ");
  const activeServices = (services ?? []).filter((s) => s.isActive);

  if (faqs.length === 1) {
    nodes.push(docNode(faqs[0], "hub", "file"));
  } else if (faqs.length > 1) {
    nodes.push({ id: "faq", kind: "topic", parentId: "hub", label: "Preguntas frecuentes", icon: "file" });
    for (const doc of faqs) nodes.push(docNode(doc, "faq", "file"));
  }

  for (const doc of manuals) nodes.push(docNode(doc, "hub", "book"));

  if (activeServices.length) {
    nodes.push({
      id: "servicios",
      kind: "topic",
      parentId: "hub",
      label: "Servicios",
      icon: "sliders",
      content: activeServices.map((s) => s.name).join(", "),
      related: bookingsEnabled ? ["Reservas"] : undefined,
    });
    for (const service of activeServices.slice(0, 8)) {
      nodes.push({
        id: `svc-${service.id}`,
        kind: "doc",
        parentId: "servicios",
        label: service.name,
        icon: iconForName(service.name),
        catalogKind: "service",
        catalogId: service.id,
        related: ["Reservas"],
        content: service.description || `${service.name} está en el catálogo. El asistente lo ofrece si lo piden.`,
      });
    }
  }

  if (bookingsEnabled) {
    nodes.push({
      id: "reservas",
      kind: "topic",
      parentId: "hub",
      label: "Reservas",
      icon: "calendar",
      content: "El asistente ayuda a reservar las experiencias activas.",
      related: activeServices.length ? ["Servicios"] : undefined,
    });
  }

  if (nodes.length === 1) {
    nodes.push({
      id: "empty",
      kind: "doc",
      parentId: "hub",
      label: "Sin documentos",
      icon: "file",
      content: "Agrega el primer conocimiento para que el asistente tenga de dónde responder.",
    });
  }

  return { nodes, edges: edgesOf(nodes) };
}

export function layoutGraph(graph: Graph): Record<string, Point> {
  const pos: Record<string, Point> = { hub: { x: 50, y: 50 } };
  const primaries = graph.nodes.filter((n) => n.parentId === "hub");
  const start = primaries.length === 3 ? (-200 * Math.PI) / 180 : -Math.PI / 2;
  primaries.forEach((node, i) => {
    const angle = start + (i / Math.max(primaries.length, 1)) * Math.PI * 2;
    const point = polar(50, 50, 26, angle);
    pos[node.id] = point;
    const kids = graph.nodes.filter((n) => n.parentId === node.id);
    const spread = Math.min(Math.PI * 0.85, 0.42 * kids.length + 0.35);
    kids.forEach((kid, k) => {
      const ka = angle - spread / 2 + ((k + 0.5) / Math.max(kids.length, 1)) * spread;
      pos[kid.id] = polar(50, 50, 41, ka);
    });
  });
  return pos;
}

export function matchesQuery(node: KnowNode, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [node.label, node.content, ...(node.related ?? [])].filter(Boolean).join(" ").toLowerCase().includes(q);
}

function docNode(doc: Doc, parentId: string, icon: string): KnowNode {
  return {
    id: doc.id,
    kind: "doc",
    parentId,
    label: prettyTitle(doc.title),
    icon: iconForName(doc.title) === "spark" ? icon : iconForName(doc.title),
    content: doc.content,
    sourceType: doc.sourceType,
    docId: doc.id,
    related: relatedFor(doc.title),
  };
}

function relatedFor(title: string) {
  const n = title.toLowerCase();
  if (/horario/.test(n)) return ["Reservas"];
  if (/entrada|precio/.test(n)) return ["Reservas", "Servicios"];
  if (/acamp/.test(n)) return ["Servicios", "Reservas"];
  if (/grupo/.test(n)) return ["Reservas"];
  if (/frecuente/.test(n)) return ["Servicios", "Reservas"];
  return undefined;
}

function prettyTitle(title: string) {
  if (title.startsWith("catalog:")) return title.split(":").slice(-1)[0] || title;
  return title;
}

function iconForName(name: string) {
  const n = name.toLowerCase();
  if (/acamp|tienda|carpa|glamp/.test(n)) return /glamp/.test(n) ? "home" : "tent";
  if (/bote|kayak|lancha/.test(n)) return "boat";
  if (/pesc/.test(n)) return "fish";
  if (/rest|comida|mesa/.test(n)) return "utensils";
  if (/recorr|sender|camin|ubic|llegar/.test(n)) return "map";
  if (/horario/.test(n)) return "clock";
  if (/entrada|precio/.test(n)) return "card";
  if (/grupo/.test(n)) return "user";
  return "spark";
}

function edgesOf(nodes: KnowNode[]): KnowEdge[] {
  return nodes.filter((n) => n.parentId).map((n) => ({ from: n.parentId as string, to: n.id }));
}

function polar(cx: number, cy: number, r: number, angle: number): Point {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * (r * 0.86) };
}
