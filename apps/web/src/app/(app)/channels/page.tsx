"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useApiGet } from "@/lib/use-api-get";
import { useAppPath } from "@/lib/app-path";
import { useMounted } from "@/lib/use-mounted";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Icon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { ChannelConfig, emptyChannel, type ChannelDraft, type ChannelFlow } from "./channel-config";

export default function ChannelsPage() {
  const mounted = useMounted();
  const { path, query: urlQuery, navigate } = useAppPath();
  const { data: items, reload } = useApiGet<ChannelDraft[]>("/channels");
  const { data: flows } = useApiGet<ChannelFlow[]>("/flows");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const { ask } = useConfirm();
  const [draft, setDraft] = useState<ChannelDraft | null>(null);
  const editKey = path === "/channels" ? urlQuery.get("edit") : null;
  const configuring = editKey != null;

  const source = useMemo(() => (items ?? []).filter((ch) => ch.type === "WHATSAPP"), [items]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return source.filter((ch) => {
      if (filter === "active" && !ch.isActive) return false;
      if (filter === "inactive" && ch.isActive) return false;
      if (!q) return true;
      return [ch.name, ch.handle, ch.flow?.name, ch.whatsappAccount?.displayPhone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, searchText, source]);

  const counts = useMemo(
    () => ({
      all: source.length,
      active: source.filter((ch) => ch.isActive).length,
      inactive: source.filter((ch) => !ch.isActive).length,
    }),
    [source],
  );

  useEffect(() => {
    if (!configuring) {
      setDraft(null);
      return;
    }
    if (editKey === "new") {
      setDraft((current) => (current && !current.id ? current : emptyChannel(flows?.find((f) => f.isDefault)?.id)));
      return;
    }
    if (items === null) return;
    const found = source.find((ch) => ch.id === editKey);
    if (!found) {
      navigate("/channels");
      return;
    }
    setDraft((current) => (current?.id === found.id ? current : { ...found }));
  }, [configuring, editKey, flows, items, navigate, source]);

  function openForm(channel?: ChannelDraft) {
    setDraft(channel ? { ...channel } : emptyChannel(flows?.find((f) => f.isDefault)?.id));
    navigate(channel?.id ? `/channels?edit=${channel.id}` : "/channels?edit=new");
  }

  function closeForm() {
    setDraft(null);
    navigate("/channels");
  }

  async function toggleActive(channel: ChannelDraft) {
    await api(`/channels/${channel.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !channel.isActive }),
    });
    await reload();
  }

  async function remove(channel: ChannelDraft) {
    if (source.length <= 1) return;
    const ok = await ask({
      title: `¿Quitar ${channel.name}?`,
      body: "Las conversaciones de este canal se pierden.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    await api(`/channels/${channel.id}`, { method: "DELETE" });
    await reload();
  }

  if (!mounted) return <LoadingState label="Cargando canales…" />;

  if (configuring) {
    if (!draft) return <LoadingState label="Cargando canal…" />;
    return (
      <ChannelConfig
        key={draft.id || "new"}
        channel={draft}
        flows={flows ?? []}
        onCancel={closeForm}
        onSaved={() => {
          closeForm();
          void reload();
        }}
      />
    );
  }

  return (
    <div className="ch-page">
      <PageHeader
        actions={
          <button type="button" className="btn" onClick={() => openForm()}>
            <Icon name="plus" />
            Nuevo WhatsApp
          </button>
        }
      />

      <div className="rule-toolbar">
        <label className="pay-search">
          <Icon name="search" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar un canal…"
            aria-label="Buscar un canal"
          />
        </label>
        <div className="pay-filters" role="tablist" aria-label="Filtrar canales">
          {(
            [
              ["all", "Todos", counts.all],
              ["active", "Activos", counts.active],
              ["inactive", "Inactivos", counts.inactive],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? "on" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
              <small>{count}</small>
            </button>
          ))}
        </div>
      </div>

      {items === null && <LoadingState compact label="Cargando canales…" />}
      {items && !filtered.length && (
        <EmptyState
          title={source.length ? "Sin coincidencias" : "Sin WhatsApp"}
          body={source.length ? "Prueba otro nombre o cambia el filtro." : "Se crea solo al abrir esta pantalla. Recarga si no aparece."}
        />
      )}

      {filtered.length > 0 && (
        <div className="ch-grid">
          {filtered.map((channel) => {
            const phone = channel.whatsappAccount?.displayPhone || channel.handle || "Sin número";
            const connected = Boolean(channel.whatsappAccount);
            return (
              <article key={channel.id} className={`ch-card${channel.isActive ? "" : " is-off"}`}>
                <header>
                  <span className="rule-ico">
                    <Icon name="phone" />
                  </span>
                  <div>
                    <strong>{channel.name}</strong>
                    <p>{phone}</p>
                  </div>
                  <label className="rule-switch">
                    <button
                      type="button"
                      className="pay-switch"
                      role="switch"
                      aria-checked={channel.isActive}
                      onClick={() => void toggleActive(channel)}
                    >
                      <i />
                    </button>
                    {channel.isActive ? "Activo" : "Pausado"}
                  </label>
                </header>
                <div className="ch-meta">
                  <span className={connected ? "on" : ""}>{connected ? "Conectado" : "Sin cuenta Meta"}</span>
                  <span>{channel.flow?.name || "Flujo predeterminado"}</span>
                  <span>
                    {channel._count?.conversations ?? 0} conversaci
                    {(channel._count?.conversations ?? 0) === 1 ? "ón" : "ones"}
                  </span>
                </div>
                <footer>
                  <button type="button" className="rule-cfg-btn" onClick={() => openForm(channel)}>
                    <Icon name="pencil" />
                    Configurar
                  </button>
                  <button
                    type="button"
                    className="rule-try-link"
                    onClick={() => {
                      const flowId =
                        channel.flowId || channel.flow?.id || flows?.find((f) => f.isDefault)?.id || flows?.[0]?.id;
                      navigate(flowId ? `/flows?edit=${flowId}` : "/flows");
                    }}
                  >
                    <Icon name="play" />
                    Ver flujo
                  </button>
                  {source.length > 1 ? (
                    <button type="button" className="rule-try-link" onClick={() => void remove(channel)}>
                      Quitar
                    </button>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
