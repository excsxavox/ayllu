"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearSession, type Company } from "@/lib/api";
import { PAGE_COPY, type NavGroup } from "@/lib/nav";
import { NavLink, useAppPath } from "@/lib/app-path";
import { UnreadBadge } from "@/components/unread-badge";
import { Icon } from "@/components/icons";

export function AppHeader({
  name,
  companies,
  companyId,
  groups,
  isPlatformAdmin,
  onCompanyChange,
  onOpenMenu,
}: {
  name: string;
  companies: Company[];
  companyId: string;
  groups: NavGroup[];
  isPlatformAdmin?: boolean;
  onCompanyChange: (id: string) => void;
  onOpenMenu: () => void;
}) {
  const { path, query: urlQuery, navigate } = useAppPath();
  const router = useRouter();
  const page = PAGE_COPY[path];
  const company = companies.find((c) => c.id === companyId);
  const [searchText, setSearchText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(
    () => [
      ...groups.flatMap((g) =>
        g.links.map((link) => ({ ...link, group: g.title, blurb: PAGE_COPY[link.href]?.lead ?? g.blurb })),
      ),
      { href: "/settings", label: "Configuración", icon: "gear", group: "Espacio de trabajo", blurb: PAGE_COPY["/settings"].lead },
    ],
    [groups],
  );
  const results = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return pages.slice(0, 6);
    return pages
      .filter(
        (p) => p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [searchText, pages]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!searchRef.current?.contains(t)) setSearchOpen(false);
      if (!menuRef.current?.contains(t)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(href: string) {
    setSearchText("");
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(href);
  }

  return (
    <header className="app-header" suppressHydrationWarning>
      <button type="button" className="mobile-menu" onClick={onOpenMenu} aria-label="Abrir menú">
        <Icon name="menu" />
      </button>
      <p className="header-crumb">
        Espacio de trabajo <span>/</span>{" "}
        {urlQuery.get("edit") != null && path === "/payments" ? (
          <>
            Pagos <span>/</span> <strong>Configuración</strong>
          </>
        ) : urlQuery.get("edit") != null && path === "/replies" ? (
          <>
            Respuestas <span>/</span> <strong>Configuración</strong>
          </>
        ) : urlQuery.get("edit") != null && path === "/services" ? (
          <>
            Servicios <span>/</span> <strong>{urlQuery.get("edit") === "new" ? "Agregar" : "Configuración"}</strong>
          </>
        ) : urlQuery.get("edit") != null && path === "/rules" ? (
          <>
            Reglas del bot <span>/</span> <strong>Configurar</strong>
          </>
        ) : urlQuery.get("edit") != null && path === "/flows" ? (
          <>
            Flujos <span>/</span> <strong>{urlQuery.get("edit") === "new" ? "Crear" : "Editar"}</strong>
          </>
        ) : urlQuery.get("edit") != null && path === "/channels" ? (
          <>
            Canales <span>/</span> <strong>{urlQuery.get("edit") === "new" ? "Nuevo" : "Configurar"}</strong>
          </>
        ) : (
          <strong>{path === "/dashboard" ? "Inicio" : (page?.title ?? "Panel")}</strong>
        )}
      </p>

      <div className="header-search" ref={searchRef} suppressHydrationWarning>
        <Icon name="search" />
        <input
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Buscar en el espacio…"
          aria-label="Buscar pantalla"
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          suppressHydrationWarning
        />
        {searchOpen && (
          <div className="header-pop">
            {results.map((p) => (
              <button key={p.href} type="button" className={path === p.href ? "on" : ""} onClick={() => go(p.href)}>
                <Icon name={p.icon} />
                <span>
                  <b>{p.label}</b>
                  <small>{p.group}</small>
                </span>
              </button>
            ))}
            {!results.length && <p className="muted">Sin coincidencias</p>}
          </div>
        )}
      </div>

      <div className="header-right">
        <NavLink href="/alerts" className="header-bell" aria-label="Alertas">
          <Icon name="bell" />
          <UnreadBadge />
        </NavLink>
        <div className="header-company" suppressHydrationWarning>
          <Icon name="building" />
          <select
            value={companyId}
            onChange={(e) => onCompanyChange(e.target.value)}
            aria-label="Empresa activa"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-dashlane-label="false"
            suppressHydrationWarning
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="header-user" ref={menuRef} suppressHydrationWarning>
          <button
            type="button"
            className="header-user-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            data-dashlane-label="false"
            data-form-type="other"
            suppressHydrationWarning
          >
            <span className="avatar">{initials(name || "AY")}</span>
          </button>
          {menuOpen && (
            <div className="header-pop user-pop">
              <p className="header-pop-meta">
                {name}
                <small>{company?.name ?? "Empresa"}</small>
              </p>
              <button type="button" onClick={() => go("/settings")}>
                <Icon name="gear" />
                <span>Configuración</span>
              </button>
              {isPlatformAdmin ? (
                <button type="button" onClick={() => go("/admin")}>
                  <Icon name="shield" />
                  <span>Planes</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  router.replace("/login");
                }}
              >
                <Icon name="logout" />
                <span>Salir</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
