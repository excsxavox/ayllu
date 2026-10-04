"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearSession, getSession, prefetchApp, setCompanyId, type AuthUser, type Company } from "@/lib/api";
import { visibleNavGroups } from "@/lib/nav";
import { NavLink, useAppPath } from "@/lib/app-path";
import { BrandMark, Icon } from "@/components/icons";
import { LoadingState } from "@/components/loading-state";
import { AppHeader } from "@/components/app-header";
import { AppScreen } from "@/components/app-screen";
import { UnreadBadge } from "@/components/unread-badge";
import { InboxBadge } from "@/components/inbox-badge";
import { COMPANY_CHANGED, FEATURES_CHANGED } from "@/lib/events";
import { FloorApp } from "@/components/floor-app";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { IS_FLOOR_APP } from "@/lib/app-mode";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Shell() {
  const router = useRouter();
  const { path, navigate } = useAppPath();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCid] = useState<string>("");
  const [name, setName] = useState("");
  const [platformRole, setPlatformRole] = useState<AuthUser["platformRole"]>("USER");
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const company = companies.find((c) => c.id === companyId);
  const groups = visibleNavGroups({
    bookingsEnabled: Boolean(company?.bookingsEnabled),
    isPlatformAdmin: platformRole === "PLATFORM_ADMIN",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s?.accessToken) {
      router.replace(IS_FLOOR_APP ? "/login?next=/floor" : "/login");
      return;
    }
    api<{ name: string; platformRole: AuthUser["platformRole"]; companies: Company[] }>("/auth/me")
      .then((me) => {
        setName(me.name);
        setPlatformRole(me.platformRole);
        setCompanies(me.companies);
        const current = s.companyId || me.companies[0]?.id || "";
        if (current && current !== s.companyId) setCompanyId(current);
        setCid(current);
        setReady(true);
        if (typeof window !== "undefined") {
          window.requestIdleCallback?.(() => prefetchApp()) ?? prefetchApp();
        }
      })
      .catch(() => router.replace(IS_FLOOR_APP ? "/login?next=/floor" : "/login"));
  }, [router]);

  useEffect(() => {
    function refreshFeatures() {
      api<{ companies: Company[] }>("/auth/me")
        .then((me) => setCompanies(me.companies))
        .catch(() => undefined);
    }
    function onCompany(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      setCompanyId(id);
      setCid(id);
    }
    window.addEventListener(FEATURES_CHANGED, refreshFeatures);
    window.addEventListener(COMPANY_CHANGED, onCompany);
    return () => {
      window.removeEventListener(FEATURES_CHANGED, refreshFeatures);
      window.removeEventListener(COMPANY_CHANGED, onCompany);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (IS_FLOOR_APP && path !== "/floor") navigate("/floor");
    if (!IS_FLOOR_APP && path === "/floor") navigate("/dashboard");
    if (!IS_FLOOR_APP && ready && path === "/audit" && platformRole !== "PLATFORM_ADMIN") {
      navigate("/dashboard");
    }
  }, [path, navigate, ready, platformRole]);

  if (!mounted || !ready) {
    return <LoadingState label="Cargando…" />;
  }

  if (IS_FLOOR_APP && path === "/floor") {
    return (
      <ConfirmProvider>
        <FloorApp
          company={company}
          companies={companies}
          name={name}
          onCompanyChange={(next) => {
            setCompanyId(next);
            setCid(next);
          }}
          onExit={() => navigate("/dashboard")}
          onLogout={() => {
            clearSession();
            router.replace("/login?next=/floor");
          }}
        />
      </ConfirmProvider>
    );
  }

  return (
    <ConfirmProvider>
      <div className={`app-shell${path === "/inbox" ? " is-inbox" : ""}${menuOpen ? " menu-open" : ""}`}>
      <div className="mobile-scrim" onClick={() => setMenuOpen(false)} />
      <aside className="sidebar">
        <NavLink href="/dashboard" className="brand">
          <BrandMark />
          Aylluu <span>WA</span>
        </NavLink>
        <button type="button" className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
          <Icon name="close" />
        </button>
        <div className="workspace-chip">
          <span className="avatar">{initials(company?.name || "AY")}</span>
          <div>
            <strong>{company?.name ?? "Empresa"}</strong>
            <p>Espacio de trabajo</p>
          </div>
        </div>
        <nav className="nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.id}>
              <p className="nav-kicker">{group.title}</p>
              <div className="nav-links">
                {group.links.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    className={`nav-link ${path === link.href ? "active" : ""}`}
                    aria-current={path === link.href ? "page" : undefined}
                  >
                    <span className="nav-link-label">
                      <Icon name={link.icon} />
                      {link.label}
                    </span>
                    {link.href === "/inbox" && <InboxBadge />}
                    {link.href === "/alerts" && <UnreadBadge />}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink href="/settings" className={`nav-link ${path === "/settings" ? "active" : ""}`}>
            <span className="nav-link-label">
              <Icon name="gear" />
              Configuración
            </span>
          </NavLink>
          <div className="profile">
            <span className="avatar">{initials(name || "AT")}</span>
            <div>
              <strong>{name || "Cuenta"}</strong>
              <p>{platformRole === "PLATFORM_ADMIN" ? "Administrador" : "Equipo"}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              onClick={() => {
                clearSession();
                router.replace(IS_FLOOR_APP ? "/login?next=/floor" : "/login");
              }}
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <AppHeader
          name={name}
          companies={companies}
          companyId={companyId}
          groups={groups}
          isPlatformAdmin={platformRole === "PLATFORM_ADMIN"}
          onOpenMenu={() => setMenuOpen(true)}
          onCompanyChange={(next) => {
            setCompanyId(next);
            setCid(next);
            const nextCompany = companies.find((c) => c.id === next);
            if (path === "/bookings" && !nextCompany?.bookingsEnabled) navigate("/dashboard");
          }}
        />
        <main className={`main${path === "/inbox" ? " is-inbox" : ""}${path === "/dashboard" ? " is-dash" : ""}`}>
          {!ready ? (
            <LoadingState label="Cargando panel…" />
          ) : (
            <div key={companyId}>
              <AppScreen />
            </div>
          )}
        </main>
      </div>
      </div>
    </ConfirmProvider>
  );
}
