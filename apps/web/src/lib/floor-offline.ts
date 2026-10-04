import { api } from "@/lib/api";

const QUEUE_KEY = "aylluu.floor.queue";

export type OccupyBody = Record<string, unknown>;

export type FloorOp =
  | { id: string; type: "occupy"; tempId: string; body: OccupyBody }
  | { id: string; type: "patch"; bookingId: string; body: Record<string, unknown> }
  | { id: string; type: "settings"; places: unknown };

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function isNetworkError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return /conectar|Failed to fetch|NetworkError|offline|internet/i.test(message);
}

function loadQueue(): FloorOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as FloorOp[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(ops: FloorOp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
}

export function pendingFloorOps() {
  return loadQueue().length;
}

export function enqueueFloorOp(op: FloorOp) {
  saveQueue([...loadQueue(), op]);
}

export function dropOccupy(tempId: string) {
  saveQueue(loadQueue().filter((op) => !(op.type === "occupy" && op.tempId === tempId)));
}

export async function flushFloorQueue() {
  const queue = loadQueue();
  if (!queue.length) return true;
  const idMap = new Map<string, string>();
  const left: FloorOp[] = [];
  for (let i = 0; i < queue.length; i += 1) {
    const op = queue[i];
    try {
      if (op.type === "occupy") {
        const created = await api<{ id: string }>("/bookings", {
          method: "POST",
          body: JSON.stringify(op.body),
        });
        idMap.set(op.tempId, created.id);
      } else if (op.type === "patch") {
        const id = idMap.get(op.bookingId) ?? op.bookingId;
        if (id.startsWith("off_")) {
          left.push(...queue.slice(i));
          saveQueue(left);
          return false;
        }
        await api(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify(op.body) });
      } else {
        await api("/bookings/settings", {
          method: "PATCH",
          body: JSON.stringify({ places: op.places }),
        });
      }
    } catch {
      left.push(...queue.slice(i));
      saveQueue(left);
      return false;
    }
  }
  saveQueue(left);
  return left.length === 0;
}
