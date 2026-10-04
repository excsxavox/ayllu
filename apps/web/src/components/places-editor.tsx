"use client";

import { placeTracksGuests, type BookingPlace } from "@aylluu/shared";
import { Icon } from "@/components/icons";

export const PLACE_ICONS = [
  { id: "tent", label: "Carpa" },
  { id: "utensils", label: "Restaurante" },
  { id: "boat", label: "Bote" },
  { id: "map", label: "Mapa" },
  { id: "smile", label: "Juegos" },
  { id: "building", label: "Edificio" },
  { id: "spark", label: "Pesca" },
  { id: "calendar", label: "Agenda" },
  { id: "home", label: "Casa" },
] as const;

function slug(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return base || `lugar_${Date.now().toString(36)}`;
}

export function PlacesEditor({
  places,
  onChange,
}: {
  places: BookingPlace[];
  onChange: (next: BookingPlace[]) => void;
}) {
  function update(index: number, patch: Partial<BookingPlace>) {
    onChange(places.map((place, i) => (i === index ? { ...place, ...patch } : place)));
  }

  function addPlace() {
    const name = `Lugar ${places.length + 1}`;
    let id = slug(name);
    if (places.some((p) => p.id === id)) id = `${id}_${places.length + 1}`;
    onChange([
      ...places,
      {
        id,
        name,
        icon: "map",
        unitCount: 4,
        x: 16 + (places.length % 4) * 22,
        y: 22 + Math.floor(places.length / 4) * 18,
        trackGuests: false,
      },
    ]);
  }

  return (
    <div className="places-editor">
      <div className="places-editor-head">
        <div>
          <h3>Lugares y sitios</h3>
          <p className="muted">Cada lugar tiene un diagrama numerado. Cambia cuántos sitios hay (botes, mesas, carpas…).</p>
        </div>
        <button type="button" className="btn secondary compact" onClick={addPlace}>
          <Icon name="plus" /> Añadir lugar
        </button>
      </div>
      {places.map((place, index) => (
        <div className="place-row" key={place.id}>
          <label>
            <span>Icono</span>
            <select value={place.icon} onChange={(e) => update(index, { icon: e.target.value })}>
              {PLACE_ICONS.map((icon) => (
                <option key={icon.id} value={icon.id}>{icon.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Nombre</span>
            <input
              value={place.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Botes a remo"
            />
          </label>
          <label>
            <span>Sitios</span>
            <input
              type="number"
              min={1}
              max={40}
              value={place.unitCount}
              onChange={(e) => update(index, { unitCount: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })}
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Quitar ${place.name}`}
            disabled={places.length <= 1}
            onClick={() => onChange(places.filter((_, i) => i !== index))}
          >
            <Icon name="close" />
          </button>
          <label className="place-flag">
            <input
              type="checkbox"
              checked={placeTracksGuests(place)}
              onChange={(e) => update(index, { trackGuests: e.target.checked })}
            />
            <span>Ver personas al tocar, como en glamping</span>
          </label>
        </div>
      ))}
    </div>
  );
}
