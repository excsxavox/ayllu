"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type AuthUser } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { notifyCompanyChanged, notifyFeaturesChanged } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { useAppPath } from "@/lib/app-path";

type MemberRole = "COMPANY_ADMIN" | "AGENT";

type Member = {
  id: string;
  role: MemberRole;
  user: { id: string; name: string; email: string; platformRole: AuthUser["platformRole"] };
};

type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  bookingsEnabled: boolean;
  setupCompleted: boolean;
  createdAt: string;
  _count: { memberships: number; bookings: number };
  memberships?: Member[];
};

type Filter = "all" | "active" | "off";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function roleLabel(role: MemberRole) {
  return role === "AGENT" ? "Agente" : "Admin de empresa";
}

function teamLabel(members: Member[]) {
  const n = members.length;
  if (!n) return "Sin equipo";
  const admins = members.filter((m) => m.role === "COMPANY_ADMIN").length;
  const agents = n - admins;
  if (agents && admins) return `${n} · ${admins} admin · ${agents} agente${agents === 1 ? "" : "s"}`;
  if (agents) return `${n} agente${n === 1 ? "" : "s"}`;
  return `${n} admin`;
}

export default function AdminPage() {
  const { navigate } = useAppPath();
  const { ask, notice } = useConfirm();
  const { data: me } = useApiGet<{ platformRole: AuthUser["platformRole"] }>("/auth/me");
  const { data: items, setData, reload } = useApiGet<AdminCompany[]>("/admin/companies");
  const isAdmin = me?.platformRole === "PLATFORM_ADMIN";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<AdminCompany | null>(null);

  useEffect(() => {
    if (!draft) return;
    const fresh = items?.find((c) => c.id === draft.id);
    if (fresh) setDraft(fresh);
  }, [items, draft?.id]);

  const source = items ?? [];
  const counts = useMemo(
    () => ({
      all: source.length,
      active: source.filter((c) => c.bookingsEnabled).length,
      off: source.filter((c) => !c.bookingsEnabled).length,
    }),
    [source],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return source.filter((c) => {
      if (filter === "active" && !c.bookingsEnabled) return false;
      if (filter === "off" && c.bookingsEnabled) return false;
      if (!q) return true;
      return [c.name, c.slug, c.timezone].join(" ").toLowerCase().includes(q);
    });
  }, [filter, search, source]);

  function openCompany(company: AdminCompany) {
    setDraft(company);
  }

  function patchCompany(id: string, next: Partial<AdminCompany>) {
    setData((prev) => prev?.map((c) => (c.id === id ? { ...c, ...next } : c)) ?? null);
    setDraft((prev) => (prev?.id === id ? { ...prev, ...next } : prev));
  }

  async function toggle(company: AdminCompany) {
    const next = !company.bookingsEnabled;
    const action = next ? "activar" : "desactivar";
    const ok = await ask({
      title: next ? `¿Activar reservas para ${company.name}?` : `¿Quitar reservas de ${company.name}?`,
      body: next
        ? "Hazlo solo si ya contrataron el extra. La empresa podrá usar la agenda."
        : "El menú y el bot dejarán de ofrecer citas.",
      confirmLabel: next ? "Activar módulo" : "Desactivar",
      tone: next ? "default" : "danger",
    });
    if (!ok) return;
    patchCompany(company.id, { bookingsEnabled: next });
    try {
      await api(`/admin/companies/${company.id}/bookings`, {
        method: "PATCH",
        body: JSON.stringify({ bookingsEnabled: next }),
      });
      notifyFeaturesChanged();
      await reload();
    } catch (err) {
      patchCompany(company.id, { bookingsEnabled: company.bookingsEnabled });
      await notice({
        title: `No se pudo ${action}`,
        body: (err as Error).message || "Inténtalo de nuevo.",
        tone: "danger",
      });
    }
  }

  function openAgenda(company: AdminCompany) {
    if (!company.bookingsEnabled) return;
    notifyCompanyChanged(company.id);
    navigate("/bookings");
  }

  if (me && !isAdmin) {
    return (
      <div className="stack">
        <PageHeader />
        <div className="card">
          <EmptyState
            title="Solo AYLLUU"
            body="La activación del plan y los roles la hace un administrador de la plataforma."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader actions={<span className="admin-chip">Administración</span>} />

      <section className="admin-module">
        <header>
          <div className="admin-module-ico">
            <Icon name="calendar" />
          </div>
          <div>
            <h2>Módulo de reservas</h2>
            <p>Agenda, disponibilidad y gestión de reservas.</p>
          </div>
          <span className="admin-chip ghost">Activación manual</span>
        </header>
        <div className="admin-module-stats">
          <article>
            <Icon name="building" />
            <div>
              <strong>{counts.all}</strong>
              <p>Empresas</p>
            </div>
          </article>
          <article>
            <i className="admin-dot on" />
            <div>
              <strong>{counts.active}</strong>
              <p>Activas</p>
            </div>
          </article>
          <article>
            <i className="admin-dot" />
            <div>
              <strong>{counts.off}</strong>
              <p>Sin activar</p>
            </div>
          </article>
        </div>
        <p className="admin-note">
          <Icon name="lock" />
          Solo un administrador de Aylluu puede habilitar este módulo.
        </p>
      </section>

      <section className="admin-roles">
        <h2>Roles de la aplicación</h2>
        <div className="admin-role-grid">
          <article>
            <Icon name="shield" />
            <strong>Admin AYLLUU</strong>
            <p>Super admin de la plataforma. Ve Planes y Auditoría, y activa módulos por empresa.</p>
          </article>
          <article>
            <Icon name="building" />
            <strong>Admin de empresa</strong>
            <p>Opera el espacio: WhatsApp, catálogo, bot y equipo. No puede encender extras.</p>
          </article>
          <article>
            <Icon name="user" />
            <strong>Agente</strong>
            <p>Atiende bandeja, CRM y reservas del día. No configura el asistente.</p>
          </article>
        </div>
      </section>

      <div className="card catalog-card">
        <div className="catalog-toolbar admin-toolbar">
          <div className="catalog-tabs" role="tablist" aria-label="Estado del módulo">
            {(
              [
                ["all", "Todas", counts.all],
                ["active", "Activas", counts.active],
                ["off", "Sin activar", counts.off],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {label} <span className="muted">{count}</span>
              </button>
            ))}
          </div>
          <label className="catalog-search">
            <Icon name="search" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa…"
              aria-label="Buscar empresa"
            />
          </label>
        </div>
        {items === null && <LoadingState compact label="Cargando empresas…" />}
        {items && !filtered.length && (
          <EmptyState
            title={source.length ? "Sin coincidencias" : "Sin empresas"}
            body={source.length ? "Prueba otro nombre." : "Aún no hay cuentas para asignar extras."}
          />
        )}
        {filtered.length > 0 && (
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Agenda</th>
                  <th>Equipo</th>
                  <th>Acceso</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="catalog-product">
                        <span className="admin-avatar">{initials(company.name)}</span>
                        <div>
                          <strong>{company.name}</strong>
                          <small>
                            {company.slug} · {company.timezone}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`st-badge ${company.bookingsEnabled ? "resolved" : ""}`}>
                        {company.bookingsEnabled ? "Activo" : "Sin activar"}
                      </span>
                    </td>
                    <td>
                      {company.bookingsEnabled ? (
                        <button type="button" className="tag-count-link" onClick={() => openAgenda(company)}>
                          {company._count.bookings} reserva{company._count.bookings === 1 ? "" : "s"}
                          <Icon name="chevron-right" />
                        </button>
                      ) : (
                        <span>Módulo no habilitado</span>
                      )}
                    </td>
                    <td>{teamLabel(company.memberships ?? [])}</td>
                    <td>
                      <button type="button" className="btn ghost compact" onClick={() => openCompany(company)}>
                        <Icon name="gear" />
                        Administrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="catalog-pager">
              <p>
                Mostrando {filtered.length} empresa{filtered.length === 1 ? "" : "s"}
              </p>
              <div className="pager-btns">
                <button type="button" className="on">
                  1
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>

      {draft ? (
        <AccessDrawer
          company={draft}
          onClose={() => setDraft(null)}
          onToggle={() => void toggle(draft)}
          onMembers={(members) => {
            patchCompany(draft.id, { memberships: members, _count: { ...draft._count, memberships: members.length } });
          }}
        />
      ) : null}
    </div>
  );
}

function AccessDrawer({
  company,
  onClose,
  onToggle,
  onMembers,
}: {
  company: AdminCompany;
  onClose: () => void;
  onToggle: () => void;
  onMembers: (members: Member[]) => void;
}) {
  const { ask, notice } = useConfirm();
  const members = company.memberships ?? [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<MemberRole>("AGENT");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function addMember(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const next = await api<Member[]>(`/admin/companies/${company.id}/members`, {
        method: "POST",
        body: JSON.stringify({ name, email, password: password || undefined, role }),
      });
      onMembers(next);
      setName("");
      setEmail("");
      setPassword("");
      setRole("AGENT");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(member: Member, next: MemberRole) {
    try {
      const rows = await api<Member[]>(`/admin/companies/${company.id}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      onMembers(rows);
    } catch (err) {
      await notice({
        title: "No se pudo cambiar el rol",
        body: (err as Error).message || "Inténtalo de nuevo.",
        tone: "danger",
      });
    }
  }

  async function remove(member: Member) {
    const ok = await ask({
      title: `¿Quitar a ${member.user.name}?`,
      body: "Pierde el acceso a esta empresa. Su cuenta sigue existiendo.",
      confirmLabel: "Quitar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const rows = await api<Member[]>(`/admin/companies/${company.id}/members/${member.id}`, {
        method: "DELETE",
      });
      onMembers(rows);
    } catch (err) {
      await notice({
        title: "No se pudo quitar",
        body: (err as Error).message || "Inténtalo de nuevo.",
        tone: "danger",
      });
    }
  }

  return (
    <div className="drawer-back" onClick={onClose}>
      <div className="drawer admin-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="admin-access-title">
        <div className="drawer-head">
          <div>
            <h2 id="admin-access-title">Administrar acceso</h2>
            <p>Configura el módulo y el equipo de esta empresa.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>

        <div className="admin-company-card">
          <span className="admin-avatar lg">{initials(company.name)}</span>
          <div>
            <strong>{company.name}</strong>
            <p>{company.slug}</p>
          </div>
        </div>
        <p className="admin-tz">Zona horaria · {company.timezone}</p>

        <section className="pay-cfg-block">
          <h2>Módulo de reservas</h2>
          <p className="muted">{company.bookingsEnabled ? "Activo" : "Sin activar"}</p>
          <p>Habilita la agenda para esta empresa.</p>
          <ul className="admin-features">
            <li>
              <Icon name="check-circle" /> Configurar horarios y disponibilidad
            </li>
            <li>
              <Icon name="check-circle" /> Crear y gestionar reservas
            </li>
            <li>
              <Icon name="check-circle" /> Personalizar la agenda
            </li>
          </ul>
        </section>

        <section className="admin-control">
          <Icon name="lock" />
          <div>
            <strong>Control de activación</strong>
            <p>La empresa puede configurar la agenda. La activación del módulo la decide Aylluu cuando contrataron el extra.</p>
          </div>
        </section>

        <section className="pay-cfg-block">
          <h2>Equipo</h2>
          <div className="admin-members">
            {members.map((member) => (
              <article key={member.id}>
                <span className="admin-avatar">{initials(member.user.name)}</span>
                <div>
                  <strong>
                    {member.user.name}
                    {member.user.platformRole === "PLATFORM_ADMIN" ? <i>AYLLUU</i> : null}
                  </strong>
                  <small>{member.user.email}</small>
                </div>
                <select
                  value={member.role}
                  aria-label={`Rol de ${member.user.name}`}
                  onChange={(e) => void changeRole(member, e.target.value as MemberRole)}
                >
                  <option value="COMPANY_ADMIN">Admin de empresa</option>
                  <option value="AGENT">Agente</option>
                </select>
                <button type="button" className="icon-btn" aria-label={`Quitar a ${member.user.name}`} onClick={() => void remove(member)}>
                  <Icon name="close" />
                </button>
              </article>
            ))}
          </div>
          <form className="admin-invite" onSubmit={(e) => void addMember(e)}>
            <h3>Agregar persona</h3>
            <label>
              <span>Nombre</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ana Pérez" />
            </label>
            <label>
              <span>Correo</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="ana@empresa.com" />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Si ya tiene cuenta, déjala vacía"
              />
            </label>
            <label>
              <span>Rol</span>
              <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                <option value="AGENT">Agente</option>
                <option value="COMPANY_ADMIN">Admin de empresa</option>
              </select>
            </label>
            {error ? <p className="admin-invite-error">{error}</p> : null}
            <button className="btn ghost" disabled={saving}>
              {saving ? "Agregando…" : "Agregar al equipo"}
            </button>
          </form>
        </section>

        <div className="pay-cfg-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={company.bookingsEnabled ? "btn danger" : "btn"}
            onClick={onToggle}
          >
            {company.bookingsEnabled ? "Desactivar módulo" : "Activar módulo"}
          </button>
        </div>
      </div>
    </div>
  );
}
