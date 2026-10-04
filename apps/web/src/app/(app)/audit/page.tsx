"use client";

import { type AuthUser } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { useApiGet } from "@/lib/use-api-get";

type Log = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const { data: me } = useApiGet<{ platformRole: AuthUser["platformRole"] }>("/auth/me");
  const isAdmin = me?.platformRole === "PLATFORM_ADMIN";
  const { data: items } = useApiGet<Log[]>("/audit");

  return (
    <div className="stack">
      <PageHeader />
      <div className="card">
        {me && !isAdmin && (
          <EmptyState
            title="Solo AYLLUU"
            body="El historial de cambios lo ve un administrador de la plataforma."
          />
        )}
        {isAdmin && items === null && <LoadingState compact label="Cargando historial…" />}
        {isAdmin && items && !items.length && (
          <EmptyState title="Sin movimientos" body="Los cambios de catálogo, reglas y ajustes de esta empresa quedan aquí." />
        )}
        {isAdmin && items && items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Entidad</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td>
                    {l.entity} {l.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
